# Poly Haven(CC0) 소재와 간판 글꼴(OFL) 받기. sources.json 을 읽어 outdir 아래에 내려받고 manifest.jsonl 을 새로 쓴다.
#
# 사용법: python3 -I tools/nowhere/fetch_sources.py tools/nowhere/sources.json build/nowhere-src
#
#   textures → <outdir>/tex/<id>/<id>_{diff,nor_gl,arm,disp}_<res>.jpg
#   hdris    → <outdir>/hdri/<id>_<res>.hdr
#   models   → <outdir>/model/<id>/<id>_<res>.gltf (+ include 파일들)
#   fonts    → <outdir>/fonts/<file> + <outdir>/fonts/<licence_file>  (커밋 고정 raw URL, sha256 검증)
#
# - 다시 돌려도 안전하다: md5(Poly Haven)·sha256(글꼴)이 맞는 파일은 건너뛰고, manifest.jsonl 은 매번 처음부터
#   다시 쓴다(소재 하나 = 한 줄, 글꼴 하나 = 한 줄 kind="font").
# - 모든 소재를 받고 검증한 뒤에만 manifest 를 교체한다. 하나라도 실패하면 비정상 종료하고 기존 manifest 는 그대로 둔다.
# - 받은 파일은 데이터로만 다룬다. 이 스크립트도, 다른 어떤 것도 outdir 안의 파일을 실행하지 않는다.
import hashlib
import json
import os
import re
import sys
import time
import urllib.request

# 기본 Python User-Agent 는 CDN 이 403 으로 막는다.
HEADERS = {'User-Agent': 'curl/8.7.1'}
API = 'https://api.polyhaven.com'
RETRIES = 3
ID_RE = re.compile(r'^[a-z0-9_]+$')
RES_RE = re.compile(r'^[0-9]+k$')
KINDS = {'textures': 'tex', 'hdris': 'hdri', 'models': 'model'}
# 글꼴: 브랜치 이름이 아니라 40자 커밋 SHA 로 고정한 raw URL 만 받는다(같은 sha256 이 계속 나오도록).
PINNED_RE = re.compile(r'^https://raw\.githubusercontent\.com/[\w.-]+/[\w.-]+/[0-9a-f]{40}/\S+$')
SHA256_RE = re.compile(r'^[0-9a-f]{64}$')
FILE_RE = re.compile(r'^[\w.\-\[\]]+$')
FONT_LICENCES = {'OFL-1.1'}

# (결과 접미사, 후보 키들). 일부 소재는 알베도가 'Diffuse' 대신 'diff_png' 키에만 있다(예: church_bricks_02).
TEX_MAPS = (
    ('diff', ('Diffuse', 'diff_png')),
    ('nor_gl', ('nor_gl',)),
    ('arm', ('arm',)),
    ('disp', ('Displacement',)),
)


def retrying(fn):
    for attempt in range(1, RETRIES + 1):
        try:
            return fn()
        except OSError as e:  # URLError, HTTPError, 타임아웃 모두 OSError 의 하위 클래스
            if attempt == RETRIES:
                raise
            print(f'  재시도 {attempt}/{RETRIES - 1}: {e}', file=sys.stderr)
            time.sleep(2 * attempt)


def get_json(url):
    def go():
        with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=30) as r:
            return json.load(r)
    return retrying(go)


def hash_of(path, algo='md5'):
    h = hashlib.new(algo)
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def md5_of(path):
    return hash_of(path, 'md5')


def download(url, path, expected, algo='md5'):
    """path 에 받아 (상태, 실제 해시) 를 돌려준다. 해시(algo)가 맞는 파일이 이미 있으면 받지 않는다.
    .part 에 받아 검증한 뒤에만 os.replace 로 바꿔 넣는다(원자적). expected=None 이면 검증 없이 받는다."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if os.path.isfile(path):
        have = hash_of(path, algo)
        if expected is None or have == expected:
            return 'cached', have

    tmp = path + '.part'

    def go():
        h = hashlib.new(algo)
        size = 0
        with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=120) as r, open(tmp, 'wb') as out:
            for chunk in iter(lambda: r.read(1 << 20), b''):
                h.update(chunk)
                out.write(chunk)
                size += len(chunk)
        return h.hexdigest(), size

    try:
        digest, size = retrying(go)
        if expected and digest != expected:
            raise RuntimeError(f'{algo} 불일치: {url} (기대 {expected}, 실제 {digest})')
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)
    return f'{size // 1024}KB', digest


def tex_files(out, aid, res, files):
    got, missing = [], []
    for suffix, keys in TEX_MAPS:
        key = next((k for k in keys if k in files), None)
        by_fmt = files.get(key, {}).get(res, {}) if key else {}
        f = by_fmt.get('jpg') or by_fmt.get('png')
        if not f:
            missing.append(suffix)
            continue
        ext = f['url'].rsplit('.', 1)[1]
        got.append((os.path.join(out, 'tex', aid, f'{aid}_{suffix}_{res}.{ext}'), f))
    if 'diff' in missing:
        raise RuntimeError(f'{aid}: {res} 알베도 맵이 없다')
    return got, missing


def hdri_files(out, aid, res, files):
    return [(os.path.join(out, 'hdri', f'{aid}_{res}.hdr'), files['hdri'][res]['hdr'])], []


def model_files(out, aid, res, files):
    g = files['gltf'][res]['gltf']
    base = os.path.join(out, 'model', aid)
    got = [(os.path.join(base, os.path.basename(g['url'])), g)]
    for rel, inc in g.get('include', {}).items():
        path = os.path.normpath(os.path.join(base, rel))
        # 절대 경로나 '..' 로 model/<id>/ 밖을 가리키는 include 는 거부한다.
        if os.path.commonpath([os.path.abspath(path), os.path.abspath(base)]) != os.path.abspath(base):
            raise RuntimeError(f'{aid}: include 경로가 소재 폴더를 벗어난다: {rel}')
        got.append((path, inc))
    return got, []


PLANNERS = {'tex': tex_files, 'hdri': hdri_files, 'model': model_files}


def load_sources(path):
    """(Poly Haven 작업 목록, 글꼴 목록). 글꼴 항목은 커밋 고정 URL·sha256·파일 이름·라이선스를 여기서 검증한다."""
    with open(path, encoding='utf-8') as f:
        src = json.load(f)
    jobs = []
    for section, kind in KINDS.items():
        for e in src.get(section, []):
            if not ID_RE.match(e['id']) or not RES_RE.match(e['res']):
                raise ValueError(f'{section}: id/res 형식이 잘못됐다: {e}')
            jobs.append((kind, e['id'], e['res']))
    fonts = []
    for e in src.get('fonts', []):
        ok = (ID_RE.match(e.get('id', '')) and PINNED_RE.match(e.get('url', '')) and PINNED_RE.match(e.get('licence_url', ''))
              and SHA256_RE.match(e.get('sha256', '')) and SHA256_RE.match(e.get('licence_sha256', ''))
              and FILE_RE.match(e.get('file', '')) and FILE_RE.match(e.get('licence_file', '')) and e.get('licence') in FONT_LICENCES)
        if not ok:
            raise ValueError(f'fonts: 항목 형식이 잘못됐다(커밋 고정 URL·sha256·파일 이름·licence 확인): {e}')
        fonts.append(e)
    return jobs, fonts


def main():
    if len(sys.argv) != 3:
        sys.exit('사용법: python3 -I fetch_sources.py <sources.json> <outdir>')
    sources, out = sys.argv[1], sys.argv[2]
    jobs, fonts = load_sources(sources)
    os.makedirs(out, exist_ok=True)

    lines, n_files, n_bytes = [], 0, 0
    for i, (kind, aid, res) in enumerate(jobs, 1):
        files = get_json(f'{API}/files/{aid}')
        plan, missing = PLANNERS[kind](out, aid, res, files)
        rows = []
        for path, f in plan:
            status, digest = download(f['url'], path, f.get('md5'))
            rows.append((path, status, digest))
        n_files += len(rows)
        n_bytes += sum(os.path.getsize(p) for p, _, _ in rows)
        lines.append(json.dumps({
            'id': aid, 'kind': kind, 'res': res, 'licence': 'CC0',
            'source': f'https://polyhaven.com/a/{aid}',
            'files': [os.path.relpath(p, out) for p, _, _ in rows],
            'md5': {os.path.relpath(p, out): d for p, _, d in rows},
        }, ensure_ascii=False))
        note = f' (없는 맵: {", ".join(missing)})' if missing else ''
        print(f'[{i}/{len(jobs)}] {aid} {kind} {res}: ' + ', '.join(f'{os.path.basename(p)}:{s}' for p, s, _ in rows) + note, flush=True)

    for i, e in enumerate(fonts, 1):
        rows = []
        for url, name, sha in ((e['url'], e['file'], e['sha256']), (e['licence_url'], e['licence_file'], e['licence_sha256'])):
            path = os.path.join(out, 'fonts', name)
            status, digest = download(url, path, sha, 'sha256')
            rows.append((path, status, digest))
        n_files += len(rows)
        n_bytes += sum(os.path.getsize(p) for p, _, _ in rows)
        lines.append(json.dumps({
            'id': e['id'], 'kind': 'font', 'licence': e['licence'], 'source': e['url'], 'licence_source': e['licence_url'],
            'files': [os.path.relpath(p, out) for p, _, _ in rows],
            'sha256': {os.path.relpath(p, out): d for p, _, d in rows},
        }, ensure_ascii=False))
        print(f'[font {i}/{len(fonts)}] {e["id"]}: ' + ', '.join(f'{os.path.basename(p)}:{s}' for p, s, _ in rows), flush=True)

    manifest = os.path.join(out, 'manifest.jsonl')
    with open(manifest + '.tmp', 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')
    os.replace(manifest + '.tmp', manifest)
    print(f'완료: 소재 {len(jobs)}개 + 글꼴 {len(fonts)}개 = {len(lines)}줄, 파일 {n_files}개, {n_bytes / 1048576:.1f} MB -> {manifest}')


if __name__ == '__main__':
    main()
