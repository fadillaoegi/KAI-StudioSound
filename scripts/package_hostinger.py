"""Package the Hostinger static build; extract inside public_html/KAI-sound/."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parent.parent
build = root / 'dist-hostinger'
index = build / 'index.html'
if not index.is_file() or '/KAI-sound/assets/' not in index.read_text():
    raise SystemExit('Build Hostinger belum tersedia. Jalankan pnpm build:hostinger dahulu.')

release = root / 'releases' / 'KAI-sound-hostinger.zip'
release.parent.mkdir(exist_ok=True)
with ZipFile(release, 'w', compression=ZIP_DEFLATED) as archive:
    for path in sorted(build.rglob('*')):
        if path.is_file():
            if path.relative_to(build).parts[0] == 'uploads' and path.name != '.htaccess':
                continue
            archive.write(path, path.relative_to(build).as_posix())

with ZipFile(release) as archive:
    assert archive.testzip() is None, 'ZIP rusak.'
    assert 'index.html' in archive.namelist(), 'index.html harus berada langsung di dalam ZIP.'
print(f'ZIP siap diunggah: {release}')
print(f'Ukuran: {release.stat().st_size / 1024 / 1024:.2f} MB')
print('Unggah ZIP ke public_html; pilih Extract dengan nama folder KAI-sound.')
