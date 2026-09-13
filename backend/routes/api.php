<?php

use Illuminate\Support\Facades\Route;

use App\Http\Controllers\API\AuthController;
use App\Http\Controllers\API\MyClassController;
use App\Http\Controllers\API\ScheduleController;
use App\Http\Controllers\API\ClassroomController;
use App\Http\Controllers\API\SubjectController;
use App\Http\Controllers\API\DashboardController;
use App\Http\Controllers\API\TeacherSubjectController;
use App\Http\Controllers\API\JournalController;
use App\Http\Controllers\API\StudentController;
use App\Http\Controllers\API\AssignmentController;
use App\Http\Controllers\API\SubmissionController;
use App\Http\Controllers\API\FileController;

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


        /*
         * ======================================================
         * GURU - JURNAL KELAS & PRESENSI
         * ======================================================
         */

        /*
         * Daftar jadwal guru beserta status jurnal
         * dan ringkasan presensi.
         *
         * GET /api/guru/jurnal
         */
        Route::get(
            '/guru/jurnal',
            [JournalController::class, 'index']
        );

        /*
         * Riwayat jurnal suatu jadwal.
         *
         * Route ini harus diletakkan sebelum
         * /guru/jurnal/{schedule} agar "riwayat"
         * tidak dianggap sebagai parameter schedule.
         *
         * GET /api/guru/jurnal/riwayat/{schedule}
         */
        Route::get(
            '/guru/jurnal/riwayat/{schedule}',
            [JournalController::class, 'history']
        );

        /*
         * Detail satu jadwal:
         * - informasi kelas
         * - mata pelajaran
         * - daftar siswa
         * - riwayat jurnal
         *
         * GET /api/guru/jurnal/{schedule}
         */
        Route::get(
            '/guru/jurnal/{schedule}',
            [JournalController::class, 'showSchedule']
        );

        /*
         * Mulai kelas dan menyimpan:
         * - jurnal mengajar
         * - presensi seluruh siswa
         *
         * POST /api/guru/jurnal/{schedule}/mulai
         */
        Route::post(
            '/guru/jurnal/{schedule}/mulai',
            [JournalController::class, 'store']
        );

        /*
        * ======================================================
        * GURU - DAFTAR SISWA
        * ======================================================
        */

        Route::get(
            '/guru/siswa',
            [StudentController::class, 'index']
        );

        Route::get(
            '/guru/siswa/{student}',
            [StudentController::class, 'show']
        );

        Route::put(
            '/guru/siswa/{student}/presensi/{attendance}',
            [StudentController::class, 'updateAttendance']
        );

        /*
         * ======================================================
         * GURU - TUGAS
         * ======================================================
         */
        Route::get(
            '/guru/tugas', 
            [AssignmentController::class, 'index']
            );
            
        Route::post(
            '/guru/tugas', 
            [AssignmentController::class, 'store']
            );

        Route::get(
            '/guru/tugas/{assignment}', 
            [AssignmentController::class, 'show']
            );

        Route::put(
            '/guru/tugas/{assignment}', 
            [AssignmentController::class, 'update']
            );

        Route::delete(
            '/guru/tugas/{assignment}', 
            [AssignmentController::class, 'destroy']
            );


        /*Submission Tugas untuk Siswa*/    
        Route::get('/siswa/tugas', [SubmissionController::class, 'index']);
        
        Route::get('/siswa/tugas/{assignment}', [SubmissionController::class, 'show']);

        Route::post(
            '/siswa/tugas/{assignment}/submit',
            [SubmissionController::class, 'submit']
        );

        Route::get(
            '/siswa/tugas/{assignment}/submission',
            [SubmissionController::class, 'submission']
        );

        Route::put(
            '/siswa/tugas/{assignment}/submission',
            [SubmissionController::class, 'update']
        );

        Route::delete(
            '/siswa/tugas/{assignment}/submission',
            [SubmissionController::class, 'destroy']
        );
        
        /*
        |--------------------------------------------------------------------------
        | File Tugas
        |--------------------------------------------------------------------------
        */

        // Guru - file tugas
        Route::get(
            '/guru/tugas/{assignment}/file/{file}',
            [FileController::class, 'teacherAssignmentFile']
        );

        // Siswa - file tugas
        Route::get(
            '/siswa/tugas/{assignment}/file/{file}',
            [FileController::class, 'studentAssignmentFile']
        );

        Route::get(
            '/siswa/tugas/{assignment}/file/{file}/preview',
            [FileController::class, 'studentAssignmentPreview']
        );

        // Siswa - file submission sendiri
        Route::get(
            '/siswa/tugas/{assignment}/submission/file/{file}',
            [FileController::class, 'studentSubmissionFile']
        );

        Route::get(
            '/siswa/tugas/{assignment}/submission/file/{file}/preview',
            [FileController::class, 'studentSubmissionPreview']
        );

        // Guru - file submission siswa
        Route::get(
            '/guru/tugas/{assignment}/submission/file/{file}',
            [FileController::class, 'teacherSubmissionFile']
        );

        Route::get(
            '/guru/tugas/{assignment}/submission/file/{file}/preview',
            [FileController::class, 'teacherSubmissionPreview']
        );

        Route::delete(
            '/siswa/tugas/{assignment}/submission/file/{file}',
            [SubmissionController::class, 'destroyFile']
        );
    }
);