<?php

namespace Database\Seeders;

use App\Models\Classroom;
use App\Models\Student;
use App\Models\User;
use Illuminate\Database\Seeder;

class StudentSeeder extends Seeder
{
    public function run(): void
    {
        $students = [
            [
                'name' => 'Andi Pratama',
                'email' => 'andi@gmail.com',
                'classroom' => 'X - 1',
                'jenis_kelamin' => 'laki-laki',
            ],
            [
                'name' => 'Budi Santoso',
                'email' => 'budi@gmail.com',
                'classroom' => 'X - 1',
                'jenis_kelamin' => 'laki-laki',
            ],
            [
                'name' => 'Citra Lestari',
                'email' => 'citra@gmail.com',
                'classroom' => 'X - 2',
                'jenis_kelamin' => 'perempuan',
            ],
            [
                'name' => 'Dimas Saputra',
                'email' => 'dimas@gmail.com',
                'classroom' => 'X - 2',
                'jenis_kelamin' => 'laki-laki',
            ],
            [
                'name' => 'Eka Putri',
                'email' => 'eka@gmail.com',
                'classroom' => 'XI - 1',
                'jenis_kelamin' => 'perempuan',
            ],
            [
                'name' => 'Fajar Ramadhan',
                'email' => 'fajar@gmail.com',
                'classroom' => 'XI - 1',
                'jenis_kelamin' => 'laki-laki',
            ],
            [
                'name' => 'Gita Maharani',
                'email' => 'gita@gmail.com',
                'classroom' => 'XI - 2',
                'jenis_kelamin' => 'perempuan',
            ],
            [
                'name' => 'Hendra Wijaya',
                'email' => 'hendra@gmail.com',
                'classroom' => 'XI - 2',
                'jenis_kelamin' => 'laki-laki',
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

            $student = Student::updateOrCreate(
                [
                    'user_id' => $user->id,
                ],
                [
                    'jenis_kelamin' => $studentData['jenis_kelamin'],
                ]
            );

            $user->classrooms()->syncWithoutDetaching([
                $classroom->id,
            ]);

            $this->command->info(
                "{$studentData['name']} → {$classroom->name} → {$studentData['jenis_kelamin']}"
            );
        }

        $this->command->info(
            'Data siswa berhasil dibuat.'
        );
    }
}