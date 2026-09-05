<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\API\AuthController;
use App\Http\Controllers\Api\MyClassController;
use App\Http\Controllers\API\ScheduleController;
use App\Http\Controllers\API\ClassroomController;
use App\Http\Controllers\API\SubjectController;

// Route Publik (Tidak perlu login)
Route::post('/login', [AuthController::class, 'login']);

// Route untuk registrasi (jika diperlukan, misalnya untuk siswa baru atau guru baru)
Route::post('/register', [AuthController::class, 'register']);

// Route untuk mendapatkan daftar mata pelajaran dan kelas
Route::get('/subjects', [SubjectController::class, 'index']);

// Route untuk mendapatkan daftar kelas
Route::get('/classrooms', [ClassroomController::class, 'index']);

// Route untuk mendapatkan statistik (misalnya jumlah pengguna, jumlah jadwal, dll.)
Route::get('/stats', [AuthController::class, 'stats']);

// Route Private (Wajib menyertakan Bearer Token)
Route::middleware('auth:sanctum')->group(function () {
    
    // Endpoint Auth & Profil
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    
    // Endpoint Fitur KELASKU
    Route::get('/schedules', [ScheduleController::class, 'index']);

    // Endpoint Dashboard Guru
    Route::get('/guru/dashboard', [App\Http\Controllers\API\DashboardController::class, 'guru']);

    // Endpoint Kelas Saya (Guru)
    Route::get('/guru/kelas-saya', [MyClassController::class, 'index']);
    
    // Nanti Anda bisa menambahkan route lain di sini, contoh:
    // Route::apiResource('/journals', JournalController::class);
    // Route::apiResource('/assignments', AssignmentController::class);
});