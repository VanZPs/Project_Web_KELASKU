<?php

namespace Database\Seeders;

use App\Models\Submission;
use Illuminate\Database\Seeder;

class GradeSeeder extends Seeder
{
    public function run(): void
    {
        /*
         * Nilai demo berdasarkan email siswa.
         *
         * Nilai dibuat berbeda agar perhitungan
         * rata-rata setiap kelas dapat diuji.
         */
        $grades = [
            'ivan@gmail.com' => 88,
            'andi@gmail.com' => 84,
            'budi@gmail.com' => 90,

            'citra@gmail.com' => 82,
            'dimas@gmail.com' => 78,

            'eka@gmail.com' => 92,
            'fajar@gmail.com' => 86,

            'gita@gmail.com' => 80,
            'hendra@gmail.com' => 76,
        ];

        $submissions = Submission::with([
            'student.user',
            'assignment.schedule.classroom',
        ])
            ->whereHas('assignment.schedule.teacher', function ($query) {
                $query->where('nipy', '123456789');
            })
            ->get();

        if ($submissions->isEmpty()) {
            $this->command->warn(
                'Submission guru dengan NIPY 123456789 tidak ditemukan.'
            );

            return;
        }

        foreach ($submissions as $submission) {
            $email = $submission->student?->user?->email;

            if (!$email) {
                $this->command->warn(
                    "Submission ID {$submission->id} tidak memiliki data siswa."
                );

                continue;
            }

            if (!array_key_exists($email, $grades)) {
                $this->command->warn(
                    "Nilai untuk {$email} tidak ditemukan."
                );

                continue;
            }

            $grade = $grades[$email];

            $submission->update([
                'grade' => $grade,
                'teacher_feedback' => 'Nilai sudah diberikan oleh guru.',
            ]);

            $classroom = $submission
                ->assignment
                ?->schedule
                ?->classroom
                ?->name ?? '-';

            $this->command->info(
                "{$submission->student->user->name} → "
                . "{$classroom} → "
                . "Nilai {$grade}"
            );
        }

        $this->command->info(
            'Data nilai siswa berhasil diperbarui.'
        );
    }
}