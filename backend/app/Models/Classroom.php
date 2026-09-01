<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Classroom extends Model
{
    use HasFactory;

    // Mengizinkan mass assignment untuk kolom name
    protected $fillable = ['name'];

    // Satu kelas memiliki banyak siswa (merujuk ke tabel users)
    public function students()
    {
        return $this->belongsToMany(User::class, 'classroom_user', 'classroom_id', 'user_id');
    }
}