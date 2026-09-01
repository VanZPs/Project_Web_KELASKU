<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use App\Models\User;
use App\Models\Classroom;
use App\Models\Subject;
use App\Models\Schedule;

class DummyDataSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Buat Data Guru (Contoh: Guru SMA Kesatrian 1)
        $guru = User::create([
            'name' => 'Endah Soelistio',
            'email' => 'endah@kesatrian.sch.id',
            'password' => Hash::make('password123'), // Password default untuk testing
            'role' => 'guru',
            'nip_nis' => '198001012005011001',
        ]);

        // 2. Buat Data Siswa
        $siswa = User::create([
            'name' => 'Ivan Pratomo',
            'email' => 'ivan@siswa.kesatrian.sch.id',
            'password' => Hash::make('password123'),
            'role' => 'siswa',
            'nip_nis' => '2026001',
        ]);

        // 3. Buat Data Kelas & Mata Pelajaran
        $kelas = Classroom::create(['name' => 'X MIPA 1']);
        $mapel = Subject::create(['name' => 'Matematika Peminatan']);

        // 4. Masukkan Siswa ke Kelas tersebut (Menyimpan ke tabel pivot classroom_user)
        $siswa->classrooms()->attach($kelas->id);

        // 5. Buat Jadwal Mengajar
        Schedule::create([
            'classroom_id' => $kelas->id,
            'subject_id' => $mapel->id,
            'teacher_id' => $guru->id,
            'day' => 'Senin',
            'start_time' => '07:00:00',
            'end_time' => '08:30:00',
        ]);
    }
}