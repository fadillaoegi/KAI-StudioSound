<?php
declare(strict_types=1);

// PHP 8.1+, Fileinfo; no database or Node.js process is required on Hostinger.
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const MAX_LIBRARY_BYTES = 500 * 1024 * 1024;
const MAX_RECORDS = 1000;
const LIBRARY_PREFIX = "<?php http_response_code(404); exit; ?>\n";

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

final class ApiError extends RuntimeException {
    public int $status;
    public function __construct(string $message, int $status = 400) {
        parent::__construct($message);
        $this->status = $status;
    }
}

function respond(array $data, int $status = 200): void {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    exit;
}

function storageDirectory(): string {
    $directory = dirname(__DIR__) . '/uploads';
    if (!is_dir($directory) && !mkdir($directory, 0755, true) && !is_dir($directory)) {
        throw new ApiError('Folder uploads tidak dapat dibuat. Periksa izin folder project di hosting.', 503);
    }
    if (!is_writable($directory)) throw new ApiError('Folder uploads belum bisa ditulis oleh PHP. Periksa izin folder di hosting.', 503);
    return $directory;
}

function ownerKey(): string {
    $base = rtrim(dirname($_SERVER['SCRIPT_NAME'], 2), '/');
    $name = 'kaisound_owner_' . substr(hash('sha256', $base), 0, 12);
    $token = $_COOKIE[$name] ?? '';
    if (!is_string($token) || !preg_match('/^[a-f0-9]{64}$/D', $token)) {
        $token = bin2hex(random_bytes(32));
        setcookie($name, $token, [
            'expires' => time() + 31536000,
            'path' => $base . '/',
            'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    }
    return hash('sha256', $token);
}

/** Lock across readers/writers and replace the metadata file atomically. */
function withLibrary(callable $operation, bool $write = false) {
    $directory = storageDirectory();
    $lock = fopen($directory . '/.library.lock', 'c');
    if (!$lock || !flock($lock, $write ? LOCK_EX : LOCK_SH)) throw new ApiError('Koleksi sedang tidak tersedia. Coba lagi.', 503);
    try {
        $path = $directory . '/.library.php';
        $rows = [];
        if (is_file($path)) {
            $contents = file_get_contents($path);
            if ($contents === false || strpos($contents, LIBRARY_PREFIX) !== 0) throw new ApiError('Metadata koleksi tidak dapat dibaca.', 503);
            $rows = json_decode(substr($contents, strlen(LIBRARY_PREFIX)), true, 512, JSON_THROW_ON_ERROR);
            if (!is_array($rows)) throw new ApiError('Metadata koleksi tidak valid.', 503);
        }
        $result = $operation($rows);
        if ($write) {
            $temporary = $directory . '/.library-' . bin2hex(random_bytes(8)) . '.tmp';
            $json = LIBRARY_PREFIX . json_encode(array_values($rows), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
            if (file_put_contents($temporary, $json, LOCK_EX) !== strlen($json) || !rename($temporary, $path)) {
                @unlink($temporary);
                throw new ApiError('Metadata audio gagal disimpan. Periksa kapasitas hosting.', 503);
            }
        }
        return $result;
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}

function publicSound(array $row, string $owner): array {
    $sound = $row['sound'];
    $sound['canDelete'] = hash_equals($row['owner'], $owner);
    return $sound;
}

function normalizedTitle(array $input): string {
    $title = $input['title'] ?? '';
    if (!is_string($title)) throw new ApiError('Judul audio tidak valid.');
    $title = trim(preg_replace('/[\x00-\x1f\x7f]/u', ' ', $title) ?? '');
    if (!$title || !preg_match('/^.{1,120}/us', $title, $match)) throw new ApiError('Isi judul audio terlebih dahulu.');
    return $match[0];
}

function decodeObject(string $input): array {
    try { $result = json_decode($input, true, 32, JSON_THROW_ON_ERROR); }
    catch (JsonException $error) { throw new ApiError('Data permintaan tidak valid.'); }
    if (!is_array($result)) throw new ApiError('Data permintaan tidak valid.');
    return $result;
}

function requireMutationRequest(): void {
    if (($_SERVER['HTTP_X_KAISOUND_REQUEST'] ?? '') !== '1') throw new ApiError('Permintaan unggah tidak valid. Muat ulang aplikasi.', 403);
    if (($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '') === 'cross-site') throw new ApiError('Permintaan lintas situs ditolak.', 403);
    if (isset($_SERVER['HTTP_ORIGIN'])) {
        $origin = parse_url($_SERVER['HTTP_ORIGIN']);
        $host = strtolower(($origin['host'] ?? '') . (isset($origin['port']) ? ':' . $origin['port'] : ''));
        if ($host !== strtolower($_SERVER['HTTP_HOST'] ?? '')) throw new ApiError('Asal permintaan tidak diizinkan.', 403);
    }
}

$movedFile = null;
$deletedFile = null;
$originalFile = null;
try {
    $owner = ownerKey();
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($method === 'GET') {
        $sounds = withLibrary(function (array $rows) use ($owner): array {
            $result = [];
            foreach ($rows as $row) {
                if (isset($row['file']) && !is_file(storageDirectory() . '/' . $row['file'])) continue;
                $result[] = publicSound($row, $owner);
            }
            return $result;
        });
        respond(['sounds' => $sounds]);
    }
    if ($method !== 'POST') { header('Allow: GET, POST'); throw new ApiError('Metode permintaan tidak didukung.', 405); }
    requireMutationRequest();
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > MAX_AUDIO_BYTES + 1024 * 1024) throw new ApiError('Ukuran audio maksimal 25 MB.', 413);

    $multipart = strpos($_SERVER['CONTENT_TYPE'] ?? '', 'multipart/form-data') === 0;
    $payload = $multipart ? [] : decodeObject(file_get_contents('php://input') ?: '{}');
    if (!$multipart && ($payload['action'] ?? '') === 'delete') {
        $id = $payload['id'] ?? '';
        if (!is_string($id) || !preg_match('/^[a-f0-9]{32}$/D', $id)) throw new ApiError('ID audio tidak valid.');
        withLibrary(function (array &$rows) use ($id, $owner, &$deletedFile, &$originalFile): void {
            foreach ($rows as $index => $row) {
                if ($row['sound']['id'] !== $id) continue;
                if (!hash_equals($row['owner'], $owner)) throw new ApiError('Audio hanya bisa dihapus dari browser pengunggahnya.', 403);
                if (isset($row['file'])) {
                    $originalFile = storageDirectory() . '/' . $row['file'];
                    $deletedFile = storageDirectory() . '/.deleted-' . $row['file'];
                    if (is_file($originalFile) && !rename($originalFile, $deletedFile)) throw new ApiError('File audio gagal dihapus.', 503);
                }
                unset($rows[$index]);
                return;
            }
            throw new ApiError('Audio sudah tidak tersedia.', 404);
        }, true);
        if ($deletedFile && is_file($deletedFile)) @unlink($deletedFile);
        respond(['ok' => true]);
    }

    $input = $multipart ? decodeObject(is_string($_POST['sound'] ?? null) ? $_POST['sound'] : '{}') : ($payload['sound'] ?? []);
    if (!is_array($input)) throw new ApiError('Data audio tidak valid.');
    $id = bin2hex(random_bytes(16));
    $sound = ['id' => $id, 'title' => normalizedTitle($input), 'category' => 'pengumuman', 'color' => 'purple', 'uploaded' => true];
    $row = ['owner' => $owner, 'sound' => $sound, 'bytes' => 0];

    if ($multipart) {
        $file = $_FILES['file'] ?? null;
        if (!is_array($file) || !isset($file['error']) || !is_int($file['error'])) throw new ApiError('File tidak diterima. Periksa upload_max_filesize dan post_max_size di pengaturan PHP hosting.', 413);
        if (in_array($file['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) throw new ApiError('Batas unggahan PHP terlampaui. Atur upload_max_filesize minimal 25M dan post_max_size minimal 28M.', 413);
        if ($file['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'])) throw new ApiError('Unggahan audio belum lengkap. Coba lagi.');
        $bytes = filesize($file['tmp_name']);
        if (!$bytes || $bytes > MAX_AUDIO_BYTES) throw new ApiError('File harus berisi audio dan berukuran maksimal 25 MB.', 413);
        $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $allowed = [
            'mp3' => ['audio/mpeg', 'audio/mp3', 'audio/x-mpeg'],
            'wav' => ['audio/wav', 'audio/x-wav', 'audio/vnd.wave', 'audio/wave'],
            'ogg' => ['audio/ogg', 'application/ogg'],
            'm4a' => ['audio/mp4', 'video/mp4', 'application/mp4', 'audio/x-m4a'],
        ];
        if (!isset($allowed[$extension])) throw new ApiError('Pilih file MP3, WAV, OGG, atau M4A.');
        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
        if (!in_array($mime, $allowed[$extension], true)) throw new ApiError('Isi file tidak terdeteksi sebagai audio yang didukung. Pilih file audio asli.');
        $duration = $input['duration'] ?? null;
        if (!is_numeric($duration) || !is_finite((float)$duration) || $duration <= 0 || $duration > 86400) throw new ApiError('Durasi audio tidak valid.');
        $row['file'] = $id . '.' . $extension;
        $row['bytes'] = $bytes;
        $row['sound']['duration'] = (float)$duration;
        $row['sound']['subtitle'] = 'Koleksi bersama · Tersimpan di server';
        $row['sound']['src'] = 'uploads/' . $row['file'];
    } else {
        if (($payload['action'] ?? '') !== 'announcement') throw new ApiError('Aksi permintaan tidak dikenal.');
        $text = $input['text'] ?? '';
        if (!is_string($text) || !preg_match('/^.{10,1200}$/usD', trim($text))) throw new ApiError('Isi pengumuman harus terdiri dari 10–1.200 karakter.');
        $row['sound']['text'] = trim($text);
        $row['sound']['duration'] = (int)ceil(count(preg_split('/\s+/u', trim($text))) / 2.1);
        $row['sound']['subtitle'] = 'Pengumuman bersama · Suara browser';
    }

    withLibrary(function (array &$rows) use ($row, $multipart, &$movedFile): void {
        if (count($rows) >= MAX_RECORDS || array_sum(array_column($rows, 'bytes')) + $row['bytes'] > MAX_LIBRARY_BYTES) throw new ApiError('Kapasitas koleksi server penuh. Hubungi pengelola untuk mengosongkan penyimpanan.', 507);
        if ($multipart) {
            $destination = storageDirectory() . '/' . $row['file'];
            if (!move_uploaded_file($_FILES['file']['tmp_name'], $destination)) throw new ApiError('File audio gagal disimpan ke folder uploads.', 503);
            $movedFile = $destination;
            chmod($destination, 0644);
        }
        $rows[] = $row;
    }, true);
    $movedFile = null;
    respond(['sound' => publicSound($row, $owner)], 201);
} catch (Throwable $error) {
    if ($movedFile && is_file($movedFile)) @unlink($movedFile);
    if ($deletedFile && $originalFile && is_file($deletedFile)) @rename($deletedFile, $originalFile);
    if ($error instanceof ApiError) respond(['error' => $error->getMessage()], $error->status);
    error_log('KAIsound API: ' . $error->getMessage());
    respond(['error' => 'Penyimpanan audio sedang bermasalah. Periksa konfigurasi PHP dan izin folder uploads.'], 503);
}
