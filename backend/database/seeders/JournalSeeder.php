<?php

namespace Database\Seeders;

use App\Models\Journal;
use App\Models\Schedule;
use Illuminate\Database\Seeder;

class JournalSeeder extends Seeder
{
    public function run(): void
    {
        /*
         * Ambil seluruh schedule milik guru demo.
         */
        $schedules = Schedule::with([
            'classroom',
            'subject',
            'teacher',
        ])
            ->whereHas('teacher', function ($query) {
                $query->where('nipy', '123456789');
            })
            ->get();

        if ($schedules->isEmpty()) {
            $this->command->warn(
                'Schedule guru dengan NIPY 123456789 tidak ditemukan.'
            );

            return;
        }

        /*
         * Hapus seluruh jurnal yang terhubung
         * dengan schedule guru demo.
         *
         * Dengan begitu, setiap reseeding menghasilkan
         * data jurnal yang bersih dan tidak duplikat.
         */
        Journal::whereIn(
            'schedule_id',
            $schedules->pluck('id')
        )->delete();

        $journalData = [
            'X - 1' => [
                'date' => now()->toDateString(),
                'topic' => 'Pancasila dan Nilai-Nilai Kebangsaan',
                'description' => 'Pembelajaran mengenai nilai-nilai Pancasila dalam kehidupan sehari-hari.',
            ],

            'X - 2' => [
                'date' => now()->subDay()->toDateString(),
                'topic' => 'Norma dan Keadilan',
                'description' => 'Membahas jenis-jenis norma dan penerapannya dalam kehidupan bermasyarakat.',
            ],

            'XI - 1' => [
                'date' => now()->subDays(2)->toDateString(),
                'topic' => 'Demokrasi di Indonesia',
                'description' => 'Mempelajari konsep demokrasi dan penerapannya dalam sistem pemerintahan Indonesia.',
            ],

            'XI - 2' => [
                'date' => now()->subDays(3)->toDateString(),
                'topic' => 'Hak dan Kewajiban Warga Negara',
                'description' => 'Pembahasan mengenai hak dan kewajiban warga negara berdasarkan konstitusi.',
            ],
        ];

        foreach ($schedules as $schedule) {
            $classroomName = $schedule->classroom?->name;

            if (!$classroomName) {
                $this->command->warn(
                    "Schedule ID {$schedule->id} tidak memiliki kelas."
                );

                continue;
            }

            if (!isset($journalData[$classroomName])) {
                $this->command->warn(
                    "Tidak ada data jurnal untuk kelas {$classroomName}."
                );

                continue;
            }

            $data = $journalData[$classroomName];

            Journal::create([
                'schedule_id' => $schedule->id,
                'date' => $data['date'],
                'topic' => $data['topic'],
                'description' => $data['description'],
            ]);

            $this->command->info(
                "{$classroomName} → {$data['topic']}"
            );
        }

        $this->command->info(
            'Data jurnal guru berhasil disinkronkan.'
        );
    }
}