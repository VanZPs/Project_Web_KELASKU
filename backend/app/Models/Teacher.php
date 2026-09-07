<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Teacher extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'nipy',
    ];

    /**
     * Teacher -> User
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Teacher -> Subject
     *
     * Satu guru dapat mengajar beberapa mata pelajaran.
     */
    public function subjects(): BelongsToMany
    {
        return $this->belongsToMany(
            Subject::class,
            'teacher_subject'
        );
    }

    /**
     * Teacher -> Schedule
     *
     * Penting:
     * schedules.teacher_id menyimpan users.id,
     * bukan teachers.id.
     *
     * Karena itu local key yang digunakan adalah user_id.
     */
    public function schedules(): HasMany
    {
        return $this->hasMany(
            Schedule::class,
            'teacher_id',
            'user_id'
        );
    }
}