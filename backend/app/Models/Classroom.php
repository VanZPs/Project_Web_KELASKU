<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Classroom extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'archived',
    ];

    protected $casts = [
    'archived' => 'boolean',
    ];

    /**
     * Relasi ke user yang tergabung dalam kelas.
     *
     * Digunakan untuk mengambil daftar siswa
     * melalui tabel classroom_user.
     */
    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class);
    }

    /**
     * Relasi ke jadwal yang dimiliki kelas.
     */
    public function schedules(): HasMany
    {
        return $this->hasMany(Schedule::class);
    }
}