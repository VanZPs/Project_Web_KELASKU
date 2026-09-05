<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Subject;

class SubjectController extends Controller
{
    /**
     * Mengambil seluruh mata pelajaran.
     */
    public function index()
    {
        $subjects = Subject::orderBy('name')->get([
            'id',
            'name',
        ]);

        return response()->json([
            'success' => true,
            'data' => $subjects,
        ]);
    }
}