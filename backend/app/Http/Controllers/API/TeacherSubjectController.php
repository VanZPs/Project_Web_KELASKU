<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class TeacherSubjectController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        if ($user->role !== 'guru') {
            return response()->json([
                'success' => false,
                'message' =>
                    'Hanya guru yang dapat mengakses data mata pelajaran.',
            ], 403);
        }

        $teacher = $user->teacher;

        if (!$teacher) {
            return response()->json([
                'success' => false,
                'message' =>
                    'Data guru tidak ditemukan.',
            ], 404);
        }

        $subjects =
            $teacher
                ->subjects()
                ->orderBy('name')
                ->get([
                    'subjects.id',
                    'subjects.name',
                ]);

        return response()->json([
            'success' => true,
            'data' => $subjects,
        ]);
    }
}