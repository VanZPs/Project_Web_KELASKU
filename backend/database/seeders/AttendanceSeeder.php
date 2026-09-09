<?php

namespace Database\Seeders;

use App\Models\Attendance;
use App\Models\Schedule;
use App\Models\User;
use Illuminate\Database\Seeder;

class AttendanceSeeder extends Seeder
{
    public function run(): void
    {
        /*
         * Ambil jadwal milik guru demo.
         *
         * schedules.teacher_id menyimpan users.id.
         * NIPY berada di tabel teachers.
         *
         * Relasi:
         * Schedule -> User -> Teacher -> nipy
         */
        $schedules = Schedule::with([
            'classroom',
            'subject',
        ])
            ->whereHas('teacher.teacher', function ($query) {
                $query->where('nipy', '123456789');
            })
            ->get();

        if ($schedules->isEmpty()) {
            $this->command->warn(
                'Schedule guru dengan NIPY 123456789 tidak ditemukan.'
            );

            return;
        }

        /*
         * Ambil siswa yang berada di kelas yang diajar
         * oleh guru demo.
         *
         * student_id pada tabel attendances mengarah
         * ke users.id, bukan students.id.
         */
        $students = User::where('role', 'siswa')
            ->whereHas('classrooms', function ($query) use ($schedules) {
                $query->whereIn(
                    'classrooms.id',
                    $schedules->pluck('classroom_id')
                );
            })
            ->with('classrooms')
            ->get();

        if ($students->isEmpty()) {
            $this->command->warn(
                'Data siswa tidak ditemukan.'
            );

            return;
        }

        /*
         * Hapus data absensi lama untuk jadwal guru demo
         * pada tanggal hari ini.
         */
        Attendance::whereIn(
            'schedule_id',
            $schedules->pluck('id')
        )
            ->whereDate('date', today())
            ->delete();

        /*
         * Data status absensi untuk demo.
         *
         * Status:
         * - hadir
         * - sakit
         * - izin
         * - dispen
         * - alpa
         */
        $statusDemo = [
            'ivan@gmail.com' => 'hadir',
            'andi@gmail.com' => 'hadir',
            'budi@gmail.com' => 'hadir',

            'citra@gmail.com' => 'hadir',
            'dimas@gmail.com' => 'sakit',

            'eka@gmail.com' => 'dispen',
            'fajar@gmail.com' => 'izin',

            'gita@gmail.com' => 'hadir',
            'hendra@gmail.com' => 'alpa',
        ];

        foreach ($schedules as $schedule) {
            $classroom = $schedule->classroom;

            if (!$classroom) {
                $this->command->warn(
                    "Schedule ID {$schedule->id} tidak memiliki kelas."
                );

                continue;
            }

            /*
             * Ambil siswa yang benar-benar berada
             * di kelas dari jadwal tersebut.
             */
            $classStudents = $students->filter(function ($student) use ($classroom) {
                return $student->classrooms->contains(
                    'id',
                    $classroom->id
                );
            });

            foreach ($classStudents as $student) {
                $status = $statusDemo[$student->email] ?? 'hadir';

                Attendance::create([
                    'schedule_id' => $schedule->id,

                    /*
                     * PENTING:
                     * FK student_id mengarah ke users.id.
                     */
                    'student_id' => $student->id,

                    'date' => today(),

                    'status' => $status,

                    'notes' => match ($status) {
                        'sakit' => 'Siswa tidak masuk karena sakit.',
                        'izin' => 'Siswa mendapatkan izin.',
                        'dispen' => 'Siswa mendapatkan dispensasi.',
                        'alpa' => 'Siswa tidak hadir tanpa keterangan.',
                        default => null,
                    },
                ]);

                $this->command->info(
                    "{$student->name} → "
                    . "{$classroom->name} → "
                    . strtoupper($status)
                );
            }
        }

        $this->command->info(
            'Data absensi siswa berhasil dibuat.'
        );
    }
}