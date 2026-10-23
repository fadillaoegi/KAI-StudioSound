"""Real PHP/Apache integration checks. Run against an isolated test directory."""
from concurrent.futures import ThreadPoolExecutor
from http.cookiejar import CookieJar
from pathlib import Path
import json
import os
import re
import urllib.error
import urllib.request
import uuid

base = os.environ.get('KAISOUND_TEST_URL', 'http://127.0.0.1/KAI-sound/').rstrip('/') + '/'
fixture = Path(os.environ.get('KAISOUND_TEST_MP3', '/var/www/html/test.mp3')).read_bytes()
api = base + 'api/sounds.php'

def browser():
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(CookieJar()))

def send(client, url=api, data=None, headers=None):
    request = urllib.request.Request(url, data=data, headers=headers or {})
    try:
        response = client.open(request, timeout=40)
    except urllib.error.HTTPError as error:
        response = error
    content = response.read()
    if 'application/json' in response.headers.get('Content-Type', ''):
        content = json.loads(content)
    return response.status, content, response.headers

def upload(client, content=fixture, filename='Bel Stasiun.mp3', valid_header=True):
    boundary = 'kaisound' + uuid.uuid4().hex
    sound = json.dumps({'title': 'Bel Stasiun', 'duration': 9}).encode()
    body = b'--' + boundary.encode() + b'\r\nContent-Disposition: form-data; name="sound"\r\n\r\n' + sound
    body += b'\r\n--' + boundary.encode() + b'\r\nContent-Disposition: form-data; name="file"; filename="' + filename.encode() + b'"\r\nContent-Type: audio/mpeg\r\n\r\n' + content
    body += b'\r\n--' + boundary.encode() + b'--\r\n'
    headers = {'Content-Type': 'multipart/form-data; boundary=' + boundary}
    if valid_header:
        headers['X-KAISound-Request'] = '1'
    return send(client, data=body, headers=headers)

def action(client, payload):
    return send(client, data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json', 'X-KAISound-Request': '1'})

owner, visitor = browser(), browser()
status, listing, _ = send(owner)
assert status == 200 and listing['sounds'] == [], (status, listing)
assert upload(owner, valid_header=False)[0] == 403

status, uploaded, _ = upload(owner)
assert status == 201, (status, uploaded)
sound = uploaded['sound']
assert re.fullmatch(r'[a-f0-9]{32}', sound['id'])
assert sound['canDelete'] is True
assert sound['src'] == 'uploads/' + sound['id'] + '.mp3'
status, downloaded, _ = send(visitor, base + sound['src'])
assert status == 200 and downloaded == fixture
assert (Path('/var/www/html/KAI-sound') / sound['src']).is_file()

status, listing, _ = send(visitor)
assert status == 200 and listing['sounds'][0]['canDelete'] is False
assert action(visitor, {'action': 'delete', 'id': sound['id']})[0] == 403
assert upload(owner, b'<?php echo "not audio"; ?>')[0] == 400
assert upload(owner, filename='attack.php')[0] == 400
assert send(owner, base + 'uploads/.library.php')[0] == 403
assert send(owner, base + 'uploads/.library.lock')[0] == 403
assert upload(owner, b'x' * (25 * 1024 * 1024 + 1))[0] == 413

status, announcement, _ = action(owner, {'action': 'announcement', 'sound': {'title': 'Berangkat', 'text': 'Kereta tujuan Yogyakarta akan segera berangkat.'}})
assert status == 201, (status, announcement)
assert announcement['sound']['canDelete'] is True
assert announcement['sound']['text'].startswith('Kereta')

with ThreadPoolExecutor(max_workers=6) as executor:
    results = list(executor.map(lambda _: upload(owner), range(6)))
assert all(status == 201 for status, _, _ in results), results
status, listing, _ = send(owner)
assert status == 200 and len(listing['sounds']) == 8, listing
assert len({sound['id'] for sound in listing['sounds']}) == 8
for saved in listing['sounds']:
    assert action(owner, {'action': 'delete', 'id': saved['id']})[0] == 200
assert send(visitor)[1]['sounds'] == []
assert not list(Path('/var/www/html/KAI-sound/uploads').glob('*.mp3'))
print('PHP integration passed: MP3 written to disk, byte-exact playback, shared listing, owner-only deletion, file validation, 25 MB limit, private metadata, announcements, concurrent uploads, and cleanup.')
