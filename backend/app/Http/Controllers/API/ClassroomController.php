<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Classroom;

class ClassroomController extends Controller
{
    /**
     * Mengambil seluruh kelas.
     */
    public function index()
    {
        return response()->json([
            'success' => true,
            'data' => Classroom::orderBy('name')
                ->get([
                    'id',
                    'name',
                    'archived',
                ]),
        ]);
    }

    /**
     * Mengarsipkan kelas.
     */
    public function archive(Classroom $classroom)
    {
        $classroom->archived = true;
        $classroom->save();

        return response()->json([
            'success' => true,
            'message' => 'Kelas berhasil diarsipkan.',
            'data' => $classroom,
        ]);
    }

    /**
     * Memulihkan kelas dari arsip.
     */
    public function restore(Classroom $classroom)
    {
        $classroom->archived = false;
        $classroom->save();

        return response()->json([
            'success' => true,
            'message' => 'Kelas berhasil dipulihkan.',
            'data' => $classroom,
        ]);
    }
}