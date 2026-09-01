<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Schedule;
use Illuminate\Http\Request;

class ScheduleController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $schedules = [];

        if ($user->role === 'guru') {
            $schedules = Schedule::with(['classroom', 'subject'])
                                 ->where('teacher_id', $user->id)
                                 ->get();
        } else if ($user->role === 'siswa') {
            $classroomIds = $user->classrooms->pluck('id');
            $schedules = Schedule::with(['subject', 'teacher'])
                                 ->whereIn('classroom_id', $classroomIds)
                                 ->get();
        }

        return response()->json([
            'success' => true,
            'data' => $schedules
        ]);
    }
}