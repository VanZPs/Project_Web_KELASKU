<?php

namespace App\Services;

use App\Models\Assignment;
use App\Models\AssignmentQuestion;
use App\Models\Submission;
use App\Models\SubmissionAnswer;

class AutoGradingService
{
    private const GRADABLE_TYPES = [
        'short',
        'multiple',
        'checkbox',
    ];

    public function grade(
        Submission $submission,
        Assignment $assignment
    ): float {
        $questions = $assignment->questions()
            ->with('options')
            ->get()
            ->filter(function (AssignmentQuestion $question) {
                return in_array(
                    $question->type,
                    self::GRADABLE_TYPES,
                    true
                );
            })
            ->values();

        if ($questions->isEmpty()) {
            return 0.00;
        }

        $answers = $submission->answers()
            ->with('selectedOptions')
            ->get()
            ->keyBy('assignment_question_id');

        /*
         * Hanya soal yang benar-benar dijawab yang menjadi
         * bagian dari perhitungan nilai.
         *
         * Soal required yang tidak dijawab tetap dihitung
         * sebagai salah, sedangkan soal optional yang tidak
         * dijawab tidak ikut dihitung.
         */
        $gradedQuestions = $questions->filter(function (
            AssignmentQuestion $question
        ) use ($answers) {
            $answer = $answers->get($question->id);

            if ($answer) {
                return true;
            }

            return (bool) $question->is_required;
        })->values();

        if ($gradedQuestions->isEmpty()) {
            return 0.00;
        }

        $pointsPerQuestion = 100 / $gradedQuestions->count();

        $correctCount = 0;

        foreach ($gradedQuestions as $question) {
            /** @var SubmissionAnswer|null $answer */
            $answer = $answers->get($question->id);

            /*
             * Required question yang tidak dijawab dianggap salah.
             *
             * Optional question yang tidak dijawab seharusnya
             * tidak mungkin masuk ke $gradedQuestions.
             */
            if (!$answer) {
                continue;
            }

            $isCorrect = match ($question->type) {
                'short' => $this->gradeShortAnswer(
                    $answer->answer_text,
                    $question->correct_answer
                ),
                'multiple' => $this->gradeMultipleChoice(
                    $answer,
                    $question
                ),
                'checkbox' => $this->gradeCheckbox(
                    $answer,
                    $question
                ),
                default => false,
            };

            $answer->update([
                'is_correct' => $isCorrect,
                'points' => $isCorrect
                    ? round($pointsPerQuestion, 2)
                    : 0,
            ]);

            if ($isCorrect) {
                $correctCount++;
            }
        }

        $grade = ($correctCount / $gradedQuestions->count()) * 100;

        return round($grade, 2);
    }

    private function gradeShortAnswer(
        ?string $studentAnswer,
        ?string $correctAnswer
    ): bool {
        if ($studentAnswer === null || $correctAnswer === null) {
            return false;
        }

        $studentAnswer = $this->normalizeAnswer($studentAnswer);
        $correctAnswer = $this->normalizeAnswer($correctAnswer);

        if ($studentAnswer === '') {
            return false;
        }

        if ($studentAnswer === $correctAnswer) {
            return true;
        }

        $length = mb_strlen($correctAnswer);

        if ($length <= 4) {
            if (mb_strlen($studentAnswer) !== $length) {
                return false;
            }

            $allowedDistance = 1;
        } else {
            $allowedDistance = max(
                1,
                (int) floor($length * 0.15)
            );
        }

        $distance = levenshtein(
            $studentAnswer,
            $correctAnswer
        );

        return $distance <= $allowedDistance;
    }

    private function normalizeAnswer(string $answer): string
    {
        $answer = trim($answer);
        $answer = mb_strtolower($answer, 'UTF-8');

        $answer = preg_replace(
            '/[^\p{L}\p{N}]+/u',
            ' ',
            $answer
        );

        $answer = preg_replace(
            '/\s+/u',
            ' ',
            $answer
        );

        return trim($answer);
    }

    private function gradeMultipleChoice(
        SubmissionAnswer $answer,
        AssignmentQuestion $question
    ): bool {
        $correctOptionIds = $question->options
            ->filter(function ($option) {
                return (bool) $option->is_correct;
            })
            ->pluck('id')
            ->values()
            ->all();

        $selectedOptionIds = $answer->selectedOptions
            ->pluck('assignment_option_id')
            ->values()
            ->all();

        if (count($correctOptionIds) !== 1) {
            return false;
        }

        if (count($selectedOptionIds) !== 1) {
            return false;
        }

        return (int) $selectedOptionIds[0]
            === (int) $correctOptionIds[0];
    }

    private function gradeCheckbox(
        SubmissionAnswer $answer,
        AssignmentQuestion $question
    ): bool {
        $correctOptionIds = $question->options
            ->filter(function ($option) {
                return (bool) $option->is_correct;
            })
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->sort()
            ->values()
            ->all();

        $selectedOptionIds = $answer->selectedOptions
            ->pluck('assignment_option_id')
            ->map(fn ($id) => (int) $id)
            ->sort()
            ->values()
            ->all();

        return $correctOptionIds === $selectedOptionIds;
    }
}