<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class AuthController extends Controller
{
    /**
     * Register user baru.
     */
    public function register(Request $request)
    {
        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:255',
            ],

            'email' => [
                'required',
                'string',
                'email',
                'max:255',
                'unique:users,email',
            ],

            'password' => [
                'required',
                'string',
                'min:8',
                'confirmed',
            ],

            'role' => [
                'required',
                Rule::in(['guru', 'siswa']),
            ],

            /*
             * NIPY hanya wajib untuk guru.
             */
            'nipy' => [
                'nullable',
                'string',
                'max:50',
                Rule::requiredIf($request->role === 'guru'),
                Rule::unique('teachers', 'nipy'),
            ],

            /*
             * Mata pelajaran hanya wajib untuk guru.
             */
            'subject_id' => [
                'nullable',
                'integer',
                'exists:subjects,id',
                Rule::requiredIf($request->role === 'guru'),
            ],

            /*
             * Kelas hanya wajib untuk siswa.
             */
            'classroom_id' => [
                'nullable',
                'integer',
                'exists:classrooms,id',
                Rule::requiredIf($request->role === 'siswa'),
            ],

            /*
             * Jenis kelamin hanya wajib untuk siswa.
             */
            'jenis_kelamin' => [
                'nullable',
                'string',
                Rule::in([
                    'laki-laki',
                    'perempuan',
                ]),
                Rule::requiredIf($request->role === 'siswa'),
            ],
        ]);


        $user = DB::transaction(function () use ($validated) {

            /*
             * 1. Buat akun utama di tabel users.
             *
             * Password akan otomatis di-hash oleh
             * cast 'hashed' pada User.php.
             */
            $user = User::create([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'password' => $validated['password'],
                'role' => $validated['role'],
            ]);


            /*
             * 2. Jika Guru
             */
            if ($validated['role'] === 'guru') {

                $teacher = Teacher::create([
                    'user_id' => $user->id,
                    'nipy' => $validated['nipy'],
                ]);

                $teacher->subjects()->attach(
                    $validated['subject_id'],
                    [
                        'is_primary' => true,
                    ]
                );
            }


            /*
             * 3. Jika Siswa
             */
            if ($validated['role'] === 'siswa') {

                Student::create([
                    'user_id' => $user->id,
                    'jenis_kelamin' => $validated['jenis_kelamin'],
                ]);

                $user->classrooms()->attach(
                    $validated['classroom_id']
                );
            }


            return $user;
        });


        /*
         * Load relasi agar response API langsung
         * memberikan informasi profile user.
         */
        $user->load([
            'teacher.subjects',
            'student',
            'classrooms',
        ]);


        /*
         * Buat token Sanctum.
         */
        $token = $user->createToken('auth_token')->plainTextToken;


        return response()->json([
            'success' => true,
            'message' => 'Akun berhasil dibuat',
            'data' => $user,
            'token' => $token,
        ], 201);
    }


    /**
     * Login user.
     */
    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => [
                'required',
                'email',
            ],

            'password' => [
                'required',
                'string',
            ],
        ]);


        if (!Auth::attempt($credentials)) {

            return response()->json([
                'success' => false,
                'message' => 'Email atau password salah.',
            ], 401);

        }


        $user = Auth::user();


        $user->load([
            'teacher.subjects',
            'student',
            'classrooms',
        ]);


        $token = $user->createToken('auth_token')->plainTextToken;


        return response()->json([
            'success' => true,
            'message' => 'Login berhasil',
            'data' => $user,
            'token' => $token,
        ]);
    }


    /**
     * Logout user.
     */
    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()?->delete();


        return response()->json([
            'success' => true,
            'message' => 'Logout berhasil',
        ]);
    }


    /**
     * Mendapatkan data user yang sedang login.
     */
    public function me(Request $request)
    {
        $user = $request->user();


        $user->load([
            'teacher.subjects',
            'student',
            'classrooms',
        ]);


        return response()->json([
            'success' => true,
            'data' => $user,
        ]);
    }


    /**
     * Memperbarui nama user yang sedang login.
     *
     * Endpoint:
     * PUT /api/me
     */
    public function updateProfile(Request $request)
    {
        /*
         * Ambil user yang sedang login
         * berdasarkan token Sanctum.
         */
        $user = $request->user();


        /*
         * Validasi nama.
         */
        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:255',
            ],
        ]);


        /*
         * Hapus spasi berlebih di awal dan akhir
         * sebelum disimpan ke database.
         */
        $name = trim($validated['name']);


        /*
         * Update nama user.
         */
        $user->update([
            'name' => $name,
        ]);


        /*
         * Load kembali relasi user agar response
         * memiliki struktur data profile yang sama
         * dengan endpoint /me.
         */
        $user->load([
            'teacher.subjects',
            'student',
            'classrooms',
        ]);


        return response()->json([
            'success' => true,
            'message' => 'Nama berhasil diperbarui.',
            'data' => $user,
        ]);
    }


    /**
     * Statistik sederhana user.
     */
    public function stats(Request $request)
    {
        $user = $request->user();


        return response()->json([
            'success' => true,
            'data' => [
                'user_id' => $user->id,
                'role' => $user->role,
            ],
        ]);
    }
}