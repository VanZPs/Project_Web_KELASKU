<?php

use Illuminate\Support\Facades\Route;

use App\Http\Controllers\API\AuthController;
use App\Http\Controllers\API\MyClassController;
use App\Http\Controllers\API\ScheduleController;
use App\Http\Controllers\API\ClassroomController;
use App\Http\Controllers\API\SubjectController;
use App\Http\Controllers\API\DashboardController;
use App\Http\Controllers\API\TeacherSubjectController;

/*
|--------------------------------------------------------------------------
| PUBLIC ROUTES
|--------------------------------------------------------------------------
*/

/*
 * Login
 */
Route::post(
    '/login',
    [AuthController::class, 'login']
);

/*
 * Register
 */
Route::post(
    '/register',
    [AuthController::class, 'register']
);

/*
 * Daftar mata pelajaran
 */
Route::get(
    '/subjects',
    [SubjectController::class, 'index']
);

/*
 * Daftar kelas
 */
Route::get(
    '/classrooms',
    [ClassroomController::class, 'index']
);

/*
 * Statistik
 */
Route::get(
    '/stats',
    [AuthController::class, 'stats']
);


/*
|--------------------------------------------------------------------------
| PRIVATE ROUTES
|--------------------------------------------------------------------------
|
| Semua route di bawah ini membutuhkan
| Bearer Token Sanctum.
|
|--------------------------------------------------------------------------
*/

Route::middleware('auth:sanctum')->group(
    function () {

        /*
         * ======================================================
         * AUTH & PROFILE
         * ======================================================
         */

        /*
         * Logout
         */
        Route::post(
            '/logout',
            [AuthController::class, 'logout']
        );

        /*
         * User yang sedang login
         */
        Route::get(
            '/me',
            [AuthController::class, 'me']
        );

        /*
         * Memperbarui nama user yang sedang login
         */
        Route::put(
            '/me',
            [AuthController::class, 'updateProfile']
        );


        /*
         * ======================================================
         * GURU - MATA PELAJARAN
         * ======================================================
         */

        Route::get(
            '/guru/mata-pelajaran',
            [TeacherSubjectController::class, 'index']
        );

        Route::post(
            '/guru/mata-pelajaran',
            [TeacherSubjectController::class, 'store']
        );

        Route::delete(
            '/guru/mata-pelajaran/{subject}',
            [TeacherSubjectController::class, 'destroy']
        );


        /*
         * ======================================================
         * SCHEDULE
         * ======================================================
         */

        /*
         * Ambil jadwal.
         */
        Route::get(
            '/schedules',
            [ScheduleController::class, 'index']
        );

        /*
         * Guru menambahkan kelas + jadwal.
         */
        Route::post(
            '/guru/kelas',
            [ScheduleController::class, 'store']
        );

        /*
         * Jadwal yang sudah digunakan.
         */
        Route::get(
            '/guru/jadwal-terpakai',
            [ScheduleController::class, 'occupied']
        );


        /*
         * ======================================================
         * ARCHIVE CLASSROOM
         * ======================================================
         */

        /*
         * Mengarsipkan kelas.
         */
        Route::patch(
            '/guru/kelas/{classroom}/arsip',
            [ClassroomController::class, 'archive']
        );

        /*
         * Memulihkan kelas dari arsip.
         */
        Route::patch(
            '/guru/kelas/{classroom}/pulihkan',
            [ClassroomController::class, 'restore']
        );


        /*
         * ======================================================
         * GURU DASHBOARD
         * ======================================================
         */

        Route::get(
            '/guru/dashboard',
            [DashboardController::class, 'guru']
        );


        /*
         * ======================================================
         * GURU - KELAS SAYA
         * ======================================================
         */

        Route::get(
            '/guru/kelas-saya',
            [MyClassController::class, 'index']
        );
    }
);