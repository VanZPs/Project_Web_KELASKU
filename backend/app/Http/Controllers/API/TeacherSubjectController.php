<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Subject;
use Illuminate\Http\Request;

class TeacherSubjectController extends Controller
{
    /**
     * GET /api/guru/mata-pelajaran
     *
     * Mengambil seluruh mata pelajaran
     * yang diajarkan oleh guru yang sedang login.
     */
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

        $subjects = $teacher
            ->subjects()
            ->orderByDesc('teacher_subject.is_primary')
            ->orderBy('subjects.name')
            ->get([
                'subjects.id',
                'subjects.name',
            ]);

        $subjects->each(function ($subject) {
            $subject->is_primary =
                (bool) $subject->pivot->is_primary;

            unset($subject->pivot);
        });

        return response()->json([
            'success' => true,
            'data' => $subjects,
        ]);
    }


    /**
     * POST /api/guru/mata-pelajaran
     *
     * Menambahkan mata pelajaran baru
     * ke guru yang sedang login.
     */
    public function store(Request $request)
    {
        $user = $request->user();

        if ($user->role !== 'guru') {
            return response()->json([
                'success' => false,
                'message' =>
                    'Hanya guru yang dapat menambahkan mata pelajaran.',
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

        $validated = $request->validate([
            'subject_id' => [
                'required',
                'integer',
                'exists:subjects,id',
            ],
        ]);

        $alreadyExists = $teacher
            ->subjects()
            ->where('subjects.id', $validated['subject_id'])
            ->exists();

        if ($alreadyExists) {
            return response()->json([
                'success' => false,
                'message' =>
                    'Mata pelajaran tersebut sudah ditambahkan.',
            ], 422);
        }

        $teacher->subjects()->attach(
            $validated['subject_id'],
            [
                'is_primary' => false,
            ]
        );

        $subject = Subject::find(
            $validated['subject_id']
        );

        return response()->json([
            'success' => true,
            'message' =>
                'Mata pelajaran berhasil ditambahkan.',
            'data' => [
                'id' => $subject->id,
                'name' => $subject->name,
                'is_primary' => false,
            ],
        ], 201);
    }


    /**
     * DELETE /api/guru/mata-pelajaran/{subject}
     *
     * Menghapus mata pelajaran dari guru.
     */
    public function destroy(
        Request $request,
        Subject $subject
    ) {
        $user = $request->user();

        if ($user->role !== 'guru') {
            return response()->json([
                'success' => false,
                'message' =>
                    'Hanya guru yang dapat menghapus mata pelajaran.',
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

        $pivot = $teacher
            ->subjects()
            ->where('subjects.id', $subject->id)
            ->first();

        if (!$pivot) {
            return response()->json([
                'success' => false,
                'message' =>
                    'Mata pelajaran tersebut tidak terdaftar pada guru.',
            ], 404);
        }

        if ((bool) $pivot->pivot->is_primary) {
            return response()->json([
                'success' => false,
                'message' =>
                    'Mata pelajaran utama tidak dapat dihapus.',
            ], 422);
        }

        $teacher->subjects()->detach(
            $subject->id
        );

        return response()->json([
            'success' => true,
            'message' =>
                'Mata pelajaran berhasil dihapus.',
        ]);
    }
}