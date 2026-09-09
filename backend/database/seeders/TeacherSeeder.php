<?php

namespace Database\Seeders;

use App\Models\Teacher;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class TeacherSeeder extends Seeder
{
    public function run(): void
    {
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

        Teacher::updateOrCreate(
            [
                'user_id' => $user->id,
            ],
            [
                'nipy' => '123456789',
            ]
        );

        $this->command->info(
            'Data guru berhasil dibuat.'
        );
    }
}