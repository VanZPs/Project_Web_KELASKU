<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

class ProfilePhotoController extends Controller
{
    public function show(Request $request)
    {
        $key = $request->user()?->profile_photo_key;

        // Pengguna yang belum mengatur foto adalah kondisi normal, bukan error.
        if (empty($key)) {
            return response()->noContent();
        }

        $disk = Storage::disk('s3');

        // Jika referensi database ada tetapi object sudah tidak ditemukan,
        // kembalikan respons kosong agar frontend tetap memakai avatar inisial.
        if (!$disk->exists($key)) {
            return response()->noContent();
        }

        $contents = $disk->get($key);

        return response($contents, 200, [
            'Content-Type' => $disk->mimeType($key) ?: 'application/octet-stream',
            'Content-Length' => (string) strlen($contents),
            'Cache-Control' => 'private, max-age=300',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'photo' => ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
        ], [
            'photo.required' => 'Pilih foto profil terlebih dahulu.',
            'photo.image' => 'Berkas harus berupa gambar.',
            'photo.mimes' => 'Format foto harus JPG, JPEG, PNG, atau WebP.',
            'photo.max' => 'Ukuran foto maksimal 2 MB.',
        ]);

        $user = $request->user();
        $file = $validated['photo'];
        $disk = Storage::disk('s3');
        $extension = strtolower($file->getClientOriginalExtension() ?: 'jpg');
        $filename = 'profile_' . Str::uuid() . '.' . $extension;
        $directory = 'profiles/' . $user->id;

        try {
            $newKey = $disk->putFileAs($directory, $file, $filename, ['visibility' => 'private']);

            if (!$newKey) {
                return response()->json([
                    'success' => false,
                    'message' => 'Foto gagal disimpan ke object storage.',
                ], 500);
            }

            $oldKey = $user->profile_photo_key;

            try {
                $user->profile_photo_key = $newKey;
                $user->save();
            } catch (Throwable $exception) {
                $disk->delete($newKey);
                throw $exception;
            }

            if ($oldKey && $oldKey !== $newKey) {
                $disk->delete($oldKey);
            }

            return response()->json([
                'success' => true,
                'message' => 'Foto profil berhasil diperbarui.',
            ]);
        } catch (Throwable $exception) {
            report($exception);

            return response()->json([
                'success' => false,
                'message' => 'Foto profil gagal disimpan. Periksa konfigurasi MinIO.',
            ], 500);
        }
    }

    public function destroy(Request $request)
    {
        $user = $request->user();
        $key = $user->profile_photo_key;

        if (!$key) {
            return response()->json([
                'success' => true,
                'message' => 'Foto profil memang belum diatur.',
            ]);
        }

        try {
            $user->profile_photo_key = null;
            $user->save();
            Storage::disk('s3')->delete($key);

            return response()->json([
                'success' => true,
                'message' => 'Foto profil berhasil dihapus.',
            ]);
        } catch (Throwable $exception) {
            report($exception);

            return response()->json([
                'success' => false,
                'message' => 'Foto profil gagal dihapus.',
            ], 500);
        }
    }
}
