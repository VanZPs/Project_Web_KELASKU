<?php

namespace Database\Seeders;

use App\Models\Classroom;
use Illuminate\Database\Seeder;

class ClassroomSeeder extends Seeder
{
    public function run(): void
    {
        $classrooms = [
            'X - 1',
            'X - 2',
            'X - 3',
            'X - 4',
            'X - 5',
            'X - 6',
            'XI - 1',
            'XI - 2',
            'XI - 3',
            'XI - 4',
            'XI - 5',
            'XI - 6',
            'XII - 1',
            'XII - 2',
            'XII - 3',
            'XII - 4',
            'XII - 5',
            'XII - 6',
        ];

        foreach ($classrooms as $classroom) {
            Classroom::firstOrCreate([
                'name' => $classroom,
            ]);
        }
    }
}