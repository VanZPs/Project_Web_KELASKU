<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\AttendanceQrScan;
use App\Models\AttendanceSession;
use App\Models\Schedule;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AttendanceQrController extends Controller
{
    private function validateTeacherSchedule(Request $request, Schedule $schedule): array
    {
        $user = $request->user();
        abort_unless($user && $user->role === 'guru', 403, 'Akses hanya untuk guru.');
        abort_unless((int) $schedule->teacher_id === (int) $user->id, 403, 'Jadwal bukan milik guru ini.');

        $now = Carbon::now('Asia/Jakarta');
        $date = $now->toDateString();
        $day = $now->copy()->locale('id')->translatedFormat('l');
        abort_unless($schedule->day === $day, 422, 'Presensi hanya dapat digunakan pada hari jadwal berlangsung.');

        $startAt = Carbon::parse($date . ' ' . $schedule->start_time, 'Asia/Jakarta');
        $endAt = Carbon::parse($date . ' ' . $schedule->end_time, 'Asia/Jakarta');
        abort_if($now->lt($startAt), 422, 'Jam pelajaran belum dimulai.');
        abort_if($now->gte($endAt), 422, 'Jam pelajaran sudah berakhir.');

        return ['now' => $now, 'date' => $date, 'end_at' => $endAt];
    }

    public function generate(Request $request, Schedule $schedule)
    {
        $time = $this->validateTeacherSchedule($request, $schedule);
        $now = $time['now'];
        $expiresAt = $now->copy()->addMinutes(15);
        if ($expiresAt->gt($time['end_at'])) $expiresAt = $time['end_at']->copy();
        $token = Str::random(64);

        $session = DB::transaction(function () use ($schedule, $time, $token, $expiresAt, $request, $now) {
            AttendanceSession::where('schedule_id', $schedule->id)
                ->whereDate('date', $time['date'])
                ->whereNull('closed_at')
                ->update(['closed_at' => $now]);

            return AttendanceSession::create([
                'schedule_id' => $schedule->id,
                'date' => $time['date'],
                'token_hash' => hash('sha256', $token),
                'expires_at' => $expiresAt,
                'created_by' => $request->user()->id,
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'QR Code berhasil dibuat.',
            'data' => [
                'session_id' => $session->id,
                'token' => $token,
                'qr_payload' => $token,
                'expires_at' => $expiresAt->toIso8601String(),
                'server_time' => $now->toIso8601String(),
                'expires_in_seconds' => max(0, $now->diffInSeconds($expiresAt, false)),
            ],
        ]);
    }

    /**
     * Siswa hanya membuat catatan scan sementara.
     * Attendance permanen dibuat saat guru menyimpan jurnal.
     */
    public function scan(Request $request)
    {
        $student = $request->user();
        abort_unless($student && $student->role === 'siswa', 403, 'Akses hanya untuk siswa.');

        $validated = $request->validate([
            'token' => ['required', 'string', 'size:64'],
        ]);

        $session = AttendanceSession::with('schedule.classroom')
            ->where('token_hash', hash('sha256', $validated['token']))
            ->first();

        if (!$session) {
            return response()->json(['success' => false, 'message' => 'QR Code tidak valid.'], 404);
        }

        $now = Carbon::now('Asia/Jakarta');
        if ($session->closed_at !== null || $now->gte($session->expires_at)) {
            return response()->json(['success' => false, 'message' => 'QR Code sudah kedaluwarsa.'], 410);
        }

        $schedule = $session->schedule;
        if (!$schedule) {
            return response()->json(['success' => false, 'message' => 'Jadwal tidak ditemukan.'], 404);
        }

        $startAt = Carbon::parse($session->date->toDateString() . ' ' . $schedule->start_time, 'Asia/Jakarta');
        $endAt = Carbon::parse($session->date->toDateString() . ' ' . $schedule->end_time, 'Asia/Jakarta');
        if ($now->lt($startAt) || $now->gte($endAt)) {
            return response()->json(['success' => false, 'message' => 'Jadwal pelajaran sudah tidak aktif.'], 422);
        }

        $isMember = $schedule->classroom?->users()
            ->where('users.id', $student->id)
            ->where('users.role', 'siswa')
            ->exists();

        if (!$isMember) {
            return response()->json(['success' => false, 'message' => 'QR Code bukan untuk kelas Anda.'], 403);
        }

        // Jika presensi sudah pernah disimpan, jangan ubah status permanennya.
        $existingAttendance = Attendance::where('schedule_id', $schedule->id)
            ->where('student_id', $student->id)
            ->whereDate('date', $session->date)
            ->first();

        if ($existingAttendance) {
            return response()->json([
                'success' => true,
                'message' => 'Presensi Anda sudah tercatat sebelumnya.',
                'data' => ['status' => $existingAttendance->status, 'pending' => false],
            ]);
        }

        $scan = DB::transaction(function () use ($session, $student, $now) {
            $lockedSession = AttendanceSession::whereKey($session->id)->lockForUpdate()->firstOrFail();
            abort_if(
                $lockedSession->closed_at !== null || $now->gte($lockedSession->expires_at),
                410,
                'QR Code sudah kedaluwarsa.'
            );

            return AttendanceQrScan::firstOrCreate(
                [
                    'schedule_id' => $lockedSession->schedule_id,
                    'student_id' => $student->id,
                    'date' => $lockedSession->date->toDateString(),
                ],
                [
                    'attendance_session_id' => $lockedSession->id,
                    'scanned_at' => $now,
                ]
            );
        });

        return response()->json([
            'success' => true,
            'message' => $scan->wasRecentlyCreated
                ? 'Scan berhasil. Menunggu guru menyimpan jurnal.'
                : 'Scan Anda sudah diterima dan menunggu guru menyimpan jurnal.',
            'data' => [
                'status' => 'hadir',
                'pending' => true,
                'date' => $session->date->toDateString(),
            ],
        ]);
    }

    /**
     * Polling daftar scan pending untuk ditampilkan realtime di modal guru.
     */
    public function pendingScans(Request $request, Schedule $schedule)
    {
        $time = $this->validateTeacherSchedule($request, $schedule);

        $scans = AttendanceQrScan::with('student:id,name,email')
            ->where('schedule_id', $schedule->id)
            ->whereDate('date', $time['date'])
            ->get();

        return response()->json([
            'success' => true,
            'data' => $scans->map(fn ($scan) => [
                'student_id' => $scan->student_id,
                'nama' => $scan->student?->name,
                'scanned_at' => $scan->scanned_at?->toIso8601String(),
                'status' => 'hadir',
            ])->values(),
        ]);
    }

    /**
     * Batalkan scan sementara ketika guru menutup/membatalkan modal jurnal.
     */
    public function discardPending(Request $request, Schedule $schedule)
    {
        $user = $request->user();
        abort_unless($user && $user->role === 'guru', 403, 'Akses hanya untuk guru.');
        abort_unless((int) $schedule->teacher_id === (int) $user->id, 403, 'Jadwal bukan milik guru ini.');

        $date = Carbon::now('Asia/Jakarta')->toDateString();

        DB::transaction(function () use ($schedule, $date) {
            AttendanceQrScan::where('schedule_id', $schedule->id)
                ->whereDate('date', $date)
                ->delete();

            AttendanceSession::where('schedule_id', $schedule->id)
                ->whereDate('date', $date)
                ->whereNull('closed_at')
                ->update(['closed_at' => Carbon::now('Asia/Jakarta')]);
        });

        return response()->json(['success' => true, 'message' => 'Scan sementara dibatalkan.']);
    }

    public function markAllPresent(Request $request, Schedule $schedule)
    {
        $time = $this->validateTeacherSchedule($request, $schedule);
        $students = $schedule->classroom->users()->where('users.role', 'siswa')->get();

        DB::transaction(function () use ($schedule, $students, $time) {
            foreach ($students as $student) {
                Attendance::updateOrCreate(
                    ['schedule_id' => $schedule->id, 'student_id' => $student->id, 'date' => $time['date']],
                    ['status' => 'hadir', 'notes' => null]
                );
            }
        });

        return response()->json([
            'success' => true,
            'message' => 'Seluruh siswa berhasil ditetapkan hadir.',
            'data' => ['total_hadir' => $students->count()],
        ]);
    }
}
