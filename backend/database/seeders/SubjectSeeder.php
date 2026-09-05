<?php

namespace Database\Seeders;

use App\Models\Subject;
use Illuminate\Database\Seeder;

class SubjectSeeder extends Seeder
{
    public function run(): void
    {
        $subjects = [
            'Matematika',
            'Bahasa Indonesia',
            'Bahasa Inggris',
            'Bahasa Jepang',
            'Bahasa Perancis',
            'Bahasa Jawa',
            'Fisika',
            'Kimia',
            'Biologi',
            'Geografi',
            'Ekonomi',
            'Sosiologi',
            'Sejarah Indonesia',
            'PPKn',
            'Pendidikan Agama',
            'Seni Budaya',
            'PJOK',
            'PKWU',
            'Antropologi',
            'BK',
            'Lainnya',
        ];

        foreach ($subjects as $subject) {
            Subject::firstOrCreate([
                'name' => $subject,
            ]);
        }
    }
}