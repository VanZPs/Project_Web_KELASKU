<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AssignmentOption extends Model
{
    use HasFactory;

    protected $fillable = [
        'assignment_question_id',
        'option_text',
        'order',
        'is_correct',
    ];

    protected function casts(): array
    {
        return [
            'order' => 'integer',
            'is_correct' => 'boolean',
        ];
    }

    /**
     * AssignmentOption -> AssignmentQuestion
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
     * AssignmentOption -> SubmissionAnswerOption
     */
    public function submissionAnswerOptions(): HasMany
    {
        return $this->hasMany(
            SubmissionAnswerOption::class,
            'assignment_option_id',
            'id'
        );
    }
}