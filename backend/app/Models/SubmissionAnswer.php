<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SubmissionAnswer extends Model
{
    use HasFactory;

    protected $fillable = [
        'submission_id',
        'assignment_question_id',
        'answer_text',
        'is_correct',
        'points',
    ];

    protected function casts(): array
    {
        return [
            'is_correct' => 'boolean',
            'points' => 'decimal:2',
        ];
    }

    /**
     * SubmissionAnswer -> Submission
     */
    public function submission(): BelongsTo
    {
        return $this->belongsTo(
            Submission::class,
            'submission_id',
            'id'
        );
    }

    /**
     * SubmissionAnswer -> AssignmentQuestion
     */
    public function question(): BelongsTo
    {
        return $this->belongsTo(
            AssignmentQuestion::class,
            'assignment_question_id',
            'id'
        );
    }

    /**
     * SubmissionAnswer -> SubmissionAnswerOption
     */
    public function selectedOptions(): HasMany
    {
        return $this->hasMany(
            SubmissionAnswerOption::class,
            'submission_answer_id',
            'id'
        );
    }
}