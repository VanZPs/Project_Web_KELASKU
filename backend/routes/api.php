<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\API\AuthController;
use App\Http\Controllers\API\ScheduleController;

// Route Publik (Tidak perlu login)
Route::post('/login', [AuthController::class, 'login']);

// Route Private (Wajib menyertakan Bearer Token)
Route::middleware('auth:sanctum')->group(function () {
    
    // Endpoint Auth & Profil
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    
    // Endpoint Fitur KELASKU
    Route::get('/schedules', [ScheduleController::class, 'index']);
    
    // Nanti Anda bisa menambahkan route lain di sini, contoh:
    // Route::apiResource('/journals', JournalController::class);
    // Route::apiResource('/assignments', AssignmentController::class);
});