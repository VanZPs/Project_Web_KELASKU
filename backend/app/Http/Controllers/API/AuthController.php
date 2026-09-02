<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\User;

class AuthController extends Controller
{
    // Fungsi Login
    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        if (!Auth::attempt($request->only('email', 'password'))) {
            return response()->json([
                'success' => false,
                'message' => 'Email atau Password salah'
            ], 401);
        }

        $user = User::where('email', $request->email)->firstOrFail();
        
        // Membuat token Sanctum
        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Login berhasil',
            'data' => $user,
            'token' => $token
        ]);
    }

    // Fungsi Logout
    public function logout(Request $request)
    {
        // Menghapus token yang sedang digunakan
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'success' => true,
            'message' => 'Logout berhasil'
        ]);
    }

    // Fungsi Cek Profil (Me)
    public function me(Request $request)
    {
        return response()->json([
            'success' => true,
            'data' => $request->user()
        ]);
    }

    // Fungsi Ambil Statistik Publik
    public function getStats()
    {
        // Hitung jumlah user berdasarkan role dan jumlah kelas
        $guruCount = User::where('role', 'guru')->count();
        $siswaCount = User::where('role', 'siswa')->count();
        $kelasCount = \App\Models\Classroom::count();

        return response()->json([
            'success' => true,
            'data' => [
                'guru' => $guruCount,
                'siswa' => $siswaCount,
                'kelas' => $kelasCount
            ]
        ]);
    }

    // Fungsi Register
    public function register(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8',
            'role' => 'required|in:guru,siswa',
            'nip_nis' => 'required|string',
            // Subject (mapel) atau Kelas bisa di-handle terpisah di tabel pivot jika diperlukan.
            // Untuk sementara simpan data dasar User saja.
        ]);

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => \Illuminate\Support\Facades\Hash::make($request->password),
            'role' => $request->role,
            'nip_nis' => $request->nip_nis,
        ]);

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Akun berhasil dibuat',
            'data' => $user,
            'token' => $token
        ]);
    }
}