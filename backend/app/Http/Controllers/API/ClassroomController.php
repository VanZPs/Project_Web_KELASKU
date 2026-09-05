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
        $classrooms = Classroom::orderBy('name')->get([
            'id',
            'name',
        ]);

        return response()->json([
            'success' => true,
            'data' => $classrooms,
        ]);
    }
}