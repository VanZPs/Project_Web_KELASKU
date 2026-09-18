<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AssignmentQuestion extends Model
{
    use HasFactory;

    protected $fillable = [
        'assignment_id',
        'type',
        'question',
        'correct_answer',
        'order',
        'is_required',
    ];

    protected function casts(): array
    {
        return [
            'order' => 'integer',
            'is_required' => 'boolean',
        ];
    }

    /**
     * AssignmentQuestion -> Assignment
     */
    public function assignment(): BelongsTo
    {
        return $this->belongsTo(
            Assignment::class,
            'assignment_id',
            'id'
        );
    }

    /**
     * AssignmentQuestion -> AssignmentOption
     */
    public function options(): HasMany
    {
        return $this->hasMany(
            AssignmentOption::class,
            'assignment_question_id',
            'id'
        )->orderBy('order');
    }

    /**
     * AssignmentQuestion -> SubmissionAnswer
     */
    public function submissionAnswers(): HasMany
    {
        return $this->hasMany(
            SubmissionAnswer::class,
            'assignment_question_id',
            'id'
        );
    }
}