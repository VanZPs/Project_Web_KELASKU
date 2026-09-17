<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SubmissionAnswerOption extends Model
{
    use HasFactory;

    protected $fillable = [
        'submission_answer_id',
        'assignment_option_id',
    ];

    /**
     * SubmissionAnswerOption -> SubmissionAnswer
     */
    public function answer(): BelongsTo
    {
        return $this->belongsTo(
            SubmissionAnswer::class,
            'submission_answer_id',
            'id'
        );
    }

    /**
     * SubmissionAnswerOption -> AssignmentOption
     */
    public function option(): BelongsTo
    {
        return $this->belongsTo(
            AssignmentOption::class,
            'assignment_option_id',
            'id'
        );
    }
}