<?php

namespace Database\Seeders;

use App\Models\Assignment;
use App\Models\Student;
use App\Models\Submission;
use Illuminate\Database\Seeder;

class SubmissionSeeder extends Seeder
{
    public function run(): void
    {
        /*
         * Ambil assignment berdasarkan kelas.
         * Tidak menggunakan ID assignment agar aman ketika
         * AssignmentSeeder dijalankan ulang.
         */
        $assignments = Assignment::with([
            'schedule.classroom',
        ])
            ->whereHas('schedule.teacher', function ($query) {
                $query->where('nipy', '123456789');
            })
            ->get()
            ->keyBy(function ($assignment) {
                return $assignment->schedule?->classroom?->name;
            });

        if ($assignments->isEmpty()) {
            $this->command->warn(
                'Assignment guru dengan NIPY 123456789 tidak ditemukan.'
            );

            return;
        }

        /*
         * Ambil siswa berdasarkan kelas.
         */
        $students = Student::with([
            'user.classrooms',
        ])
            ->whereHas('user', function ($query) {
                $query->where('role', 'siswa');
            })
            ->get();

        if ($students->isEmpty()) {
            $this->command->warn(
                'Data siswa tidak ditemukan.'
            );

            return;
        }

        /*
         * Hapus submission lama untuk assignment guru demo.
         */
        Submission::whereIn(
            'assignment_id',
            $assignments->pluck('id')
        )->delete();

        /*
         * Daftar siswa yang akan mengumpulkan tugas.
         *
         * Setiap siswa memiliki satu submission untuk
         * assignment kelasnya.
         */
        foreach ($students as $student) {
            $classroom = $student->user?->classrooms->first();

            if (!$classroom) {
                $this->command->warn(
                    "Siswa {$student->user?->name} belum memiliki kelas."
                );

                continue;
            }

            $assignment = $assignments->get(
                $classroom->name
            );

            if (!$assignment) {
                $this->command->warn(
                    "Assignment untuk kelas {$classroom->name} tidak ditemukan."
                );

                continue;
            }

            Submission::create([
                'assignment_id' => $assignment->id,
                'student_id' => $student->id,
                'file_path' => null,
                'student_note' => 'Tugas telah dikumpulkan.',
                'grade' => null,
                'teacher_feedback' => null,
            ]);

            $this->command->info(
                "{$student->user?->name} → "
                . "{$assignment->title} → belum dinilai"
            );
        }

        $this->command->info(
            'Data submission siswa berhasil dibuat.'
        );
    }
}