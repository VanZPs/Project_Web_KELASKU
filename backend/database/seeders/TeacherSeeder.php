<?php

namespace Database\Seeders;

use App\Models\Teacher;
use App\Models\User;
use App\Models\Subject;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;

class TeacherSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Buat atau perbarui akun guru.
        $user = User::updateOrCreate(
            [
                'email' => 'endah@kesatrian.sch.id',
            ],
            [
                'name' => 'Endah Soelistio',
                'password' => Hash::make('password123'),
                'role' => 'guru',
            ]
        );

        // 2. Buat atau perbarui data guru.
        $teacher = Teacher::updateOrCreate(
            [
                'user_id' => $user->id,
            ],
            [
                'nipy' => '123456789',
            ]
        );

        // 3. Cari mata pelajaran utama guru.
        // PPKn digunakan karena ScheduleSeeder
        // juga menggunakan mata pelajaran tersebut.
        $primarySubject = Subject::where(
            'name',
            'PPKn'
        )->first();

        if (!$primarySubject) {
            $this->command->error(
                'Mata pelajaran PPKn tidak ditemukan.'
            );

            return;
        }

        // 4. Sinkronisasi mata pelajaran guru.
        DB::transaction(function () use (
            $teacher,
            $primarySubject
        ) {

            // Reset status utama pada seluruh mata pelajaran
            // yang sudah terdaftar untuk guru ini.
            $teacher->subjects()
                ->get()
                ->each(function ($subject) use ($teacher) {
                    $teacher->subjects()->updateExistingPivot(
                        $subject->id,
                        [
                            'is_primary' => false,
                        ]
                    );
                });

            // Pastikan PPKn terdaftar dan menjadi utama.
            $teacher->subjects()->syncWithoutDetaching([
                $primarySubject->id => [
                    'is_primary' => true,
                ],
            ]);
        });

        $this->command->info(
            'Data guru berhasil dibuat.'
        );

        $this->command->info(
            'Mata pelajaran utama: ' . $primarySubject->name
        );
    }
}