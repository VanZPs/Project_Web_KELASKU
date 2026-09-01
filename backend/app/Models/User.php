<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens; // Pastikan ini ada untuk fitur token API

class User extends Authenticatable
{
    // Tambahkan HasApiTokens di sini
    use HasApiTokens, HasFactory, Notifiable; 

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',       // Wajib ditambahkan
        'nip_nis',    // Wajib ditambahkan
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    // RELASI UNTUK SISWA: Satu siswa bisa tergabung di banyak kelas
    public function classrooms()
    {
        return $this->belongsToMany(Classroom::class);
    }

    // RELASI UNTUK GURU: Satu guru bisa memiliki banyak jadwal mengajar
    public function schedules()
    {
        return $this->hasMany(Schedule::class, 'teacher_id');
    }
}