<?php

namespace Database\Seeders;

use App\Models\Classroom;
use App\Models\Schedule;
use App\Models\Subject;
use App\Models\Teacher;
use Illuminate\Database\Seeder;

class ScheduleSeeder extends Seeder
{
    public function run(): void
    {
        $teacher = Teacher::where('nipy', '123456789')->first();

        if (!$teacher) {
            $this->command->warn(
                'Teacher dengan NIPY 123456789 tidak ditemukan.'
            );

            return;
        }

        $subject = Subject::where('name', 'PPKn')->first();

        if (!$subject) {
            $this->command->warn(
                'Subject PPKn tidak ditemukan.'
            );

            return;
        }

        $classrooms = Classroom::whereIn('name', [
            'X - 1',
            'X - 2',
            'XI - 1',
            'XI - 2',
        ])->get()->keyBy('name');

        $schedules = [
            [
                'classroom' => 'X - 1',
                'day' => 'Sabtu',
                'start_time' => '07:00',
                'end_time' => '08:30',
            ],
            [
                'classroom' => 'X - 2',
                'day' => 'Senin',
                'start_time' => '09:00',
                'end_time' => '10:30',
            ],
            [
                'classroom' => 'XI - 1',
                'day' => 'Selasa',
                'start_time' => '07:00',
                'end_time' => '08:30',
            ],
            [
                'classroom' => 'XI - 2',
                'day' => 'Rabu',
                'start_time' => '10:00',
                'end_time' => '11:30',
            ],
        ];

        /*
         * Hapus schedule lama milik guru demo
         * yang tidak terdapat di dalam daftar schedule di atas.
         */
        $validScheduleKeys = collect($schedules)
            ->map(function ($scheduleData) use ($classrooms) {
                $classroom = $classrooms->get(
                    $scheduleData['classroom']
                );

                if (!$classroom) {
                    return null;
                }

                return [
                    'classroom_id' => $classroom->id,
                    'day' => $scheduleData['day'],
                    'start_time' => $scheduleData['start_time'],
                ];
            })
            ->filter()
            ->values();

        Schedule::where('teacher_id', $teacher->user_id)
            ->get()
            ->each(function ($schedule) use ($validScheduleKeys) {
                $isValid = $validScheduleKeys->contains(function ($key) use ($schedule) {
                    return $schedule->classroom_id === $key['classroom_id']
                        && $schedule->day === $key['day']
                        && $schedule->start_time === $key['start_time'];
                });

                if (!$isValid) {
                    $schedule->delete();
                }
            });

        /*
         * Buat atau perbarui schedule yang ada di seeder.
         */
        foreach ($schedules as $scheduleData) {
            $classroom = $classrooms->get(
                $scheduleData['classroom']
            );

            if (!$classroom) {
                $this->command->warn(
                    "Kelas {$scheduleData['classroom']} tidak ditemukan."
                );

                continue;
            }

            Schedule::updateOrCreate(
                [
                    'teacher_id' => $teacher->user_id,
                    'classroom_id' => $classroom->id,
                    'day' => $scheduleData['day'],
                    'start_time' => $scheduleData['start_time'],
                ],
                [
                    'subject_id' => $subject->id,
                    'end_time' => $scheduleData['end_time'],
                ]
            );

            $this->command->info(
                "{$classroom->name} → {$scheduleData['day']} "
                . "{$scheduleData['start_time']} - {$scheduleData['end_time']}"
            );
        }

        $this->command->info(
            'Schedule guru berhasil disinkronkan.'
        );
    }
}