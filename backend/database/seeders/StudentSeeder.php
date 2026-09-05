<?php

namespace Database\Seeders;

use App\Models\Classroom;
use App\Models\Student;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class StudentSeeder extends Seeder
{
    public function run(): void
    {
        $students = [
            [
                'name' => 'Andi Pratama',
                'email' => 'andi@gmail.com',
                'classroom' => 'X - 1',
            ],
            [
                'name' => 'Budi Santoso',
                'email' => 'budi@gmail.com',
                'classroom' => 'X - 1',
            ],
            [
                'name' => 'Citra Lestari',
                'email' => 'citra@gmail.com',
                'classroom' => 'X - 2',
            ],
            [
                'name' => 'Dimas Saputra',
                'email' => 'dimas@gmail.com',
                'classroom' => 'X - 2',
            ],
            [
                'name' => 'Eka Putri',
                'email' => 'eka@gmail.com',
                'classroom' => 'XI - 1',
            ],
            [
                'name' => 'Fajar Ramadhan',
                'email' => 'fajar@gmail.com',
                'classroom' => 'XI - 1',
            ],
            [
                'name' => 'Gita Maharani',
                'email' => 'gita@gmail.com',
                'classroom' => 'XI - 2',
            ],
            [
                'name' => 'Hendra Wijaya',
                'email' => 'hendra@gmail.com',
                'classroom' => 'XI - 2',
            ],
        ];

        foreach ($students as $studentData) {
            $classroom = Classroom::where(
                'name',
                $studentData['classroom']
            )->first();

            if (!$classroom) {
                $this->command->warn(
                    "Kelas {$studentData['classroom']} tidak ditemukan."
                );

                continue;
            }

            $user = User::firstOrCreate(
                [
                    'email' => $studentData['email'],
                ],
                [
                    'name' => $studentData['name'],
                    'password' => 'password123',
                    'role' => 'siswa',
                ]
            );

            $student = Student::firstOrCreate([
                'user_id' => $user->id,
            ]);

            $user->classrooms()->syncWithoutDetaching([
                $classroom->id,
            ]);

            $this->command->info(
                "{$studentData['name']} → {$classroom->name}"
            );
        }

        $this->command->info(
            'Data siswa berhasil dibuat.'
        );
    }
}