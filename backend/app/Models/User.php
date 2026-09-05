<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * Field yang boleh diisi menggunakan mass assignment.
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
    ];

    /**
     * Field yang disembunyikan dari response JSON.
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Casting attribute.
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    /**
     * Relasi User -> Teacher.
     *
     * Satu User dengan role guru memiliki satu Teacher.
     */
    public function teacher(): HasOne
    {
        return $this->hasOne(Teacher::class);
    }

    /**
     * Relasi User -> Student.
     *
     * Satu User dengan role siswa memiliki satu Student.
     */
    public function student(): HasOne
    {
        return $this->hasOne(Student::class);
    }

    /**
     * Relasi User -> Classroom.
     *
     * Satu siswa dapat tergabung dalam satu atau lebih kelas.
     */
    public function classrooms(): BelongsToMany
    {
        return $this->belongsToMany(Classroom::class);
    }
}