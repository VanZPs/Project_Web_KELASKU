<?php

namespace Database\Seeders;

use App\Models\Assignment;
use App\Models\Schedule;
use Illuminate\Database\Seeder;

class AssignmentSeeder extends Seeder
{
    public function run(): void
    {
        /*
         * Ambil schedule milik guru demo berdasarkan NIPY,
         * bukan berdasarkan ID agar aman ketika schedule di-seed ulang.
         */
        $schedules = Schedule::with([
            'classroom',
            'subject',
            'teacher',
        ])
            ->whereHas('teacher', function ($query) {
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
         * Hapus assignment lama milik schedule guru demo.
         *
         * Karena ini data testing, kita ingin setiap reseeding
         * menghasilkan data yang bersih dan konsisten.
         */
        Assignment::whereIn(
            'schedule_id',
            $schedules->pluck('id')
        )->delete();

        $assignmentData = [
            'X - 1' => [
                'title' => 'Latihan Pancasila dan Nilai-Nilai Kebangsaan',
                'description' => 'Kerjakan latihan mengenai penerapan nilai-nilai Pancasila dalam kehidupan sehari-hari.',
                'due_date' => now()->addDays(2),
            ],

            'X - 2' => [
                'title' => 'Tugas Norma dan Keadilan',
                'description' => 'Jelaskan jenis-jenis norma dan berikan contoh penerapannya dalam kehidupan masyarakat.',
                'due_date' => now()->addDay(),
            ],

            'XI - 1' => [
                'title' => 'Analisis Demokrasi di Indonesia',
                'description' => 'Buat analisis singkat mengenai penerapan demokrasi di Indonesia.',
                'due_date' => now()->subDay(),
            ],

            'XI - 2' => [
                'title' => 'Hak dan Kewajiban Warga Negara',
                'description' => 'Jelaskan contoh hak dan kewajiban warga negara dalam kehidupan sehari-hari.',
                'due_date' => now()->subDays(2),
            ],
        ];

        foreach ($schedules as $schedule) {
            $classroomName = $schedule->classroom?->name;

            if (!$classroomName) {
                $this->command->warn(
                    "Schedule ID {$schedule->id} tidak memiliki kelas."
                );

                continue;
            }

            if (!isset($assignmentData[$classroomName])) {
                $this->command->warn(
                    "Tidak ada data tugas untuk kelas {$classroomName}."
                );

                continue;
            }

            $data = $assignmentData[$classroomName];

            Assignment::create([
                'schedule_id' => $schedule->id,
                'title' => $data['title'],
                'description' => $data['description'],
                'due_date' => $data['due_date'],
            ]);

            $this->command->info(
                "{$classroomName} → {$data['title']}"
            );
        }

        $this->command->info(
            'Data tugas guru berhasil disinkronkan.'
        );
    }
}