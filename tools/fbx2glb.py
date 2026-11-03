"""FBX(7400 binary, Blender export) → glTF 2.0 GLB 변환기.

외부 3D 툴(Blender·FBX SDK) 없이 동작한다. 하는 일:
  - 월드 변환(스케일 100, X -90°) 굽기 → 미터 단위 · Y-up · 바닥 중심 원점
  - n-gon 팬 삼각분할, 정점 노멀·UV0 보존, 재질별 프리미티브 분할
  - 내장 텍스처 추출 → 최대 2048px 리사이즈, roughness/metallic 을 ORM 한 장으로 합성
  - 텍스처가 내장돼 있지 않으면 <텍스처 폴더> 에서 같은 파일명(대소문자 무시)을 찾는다
  - 노드 extras 에 층(floor)·부위(part = 첫 재질명)·높이 범위 기록
사용: python fbx2glb.py <fbxparse 디렉터리> <in.fbx> <out.glb> [텍스처 폴더]
"""
import sys, io, json, math, re, struct, collections, hashlib
import numpy as np
from PIL import Image

sys.path.insert(0, sys.argv[1])
from fbxparse import parse  # noqa: E402

import os
SRC, OUT = sys.argv[2], sys.argv[3]
TEX_DIR = sys.argv[4] if len(sys.argv) > 4 else None
tex_files = {}
if TEX_DIR:
    for dp, _, fs in os.walk(TEX_DIR):
        for f in fs: tex_files.setdefault(f.lower(), os.path.join(dp, f))
EXCLUDE = set()   # Cube·Plane 은 이름만 임시 — 6F 슬래브·포디움 코어 위치라 보존
MAX_TEX = 2048

ver, nodes = parse(SRC)
top = {n['name']: n for n in nodes}
objs = top['Objects']['children']
byid = {o['props'][0]: o for o in objs}


def nm(o): return o['props'][1].split('\x00')[0]
def ch(n, name): return [c for c in n['children'] if c['name'] == name]


def arr(v):
    _, t, n, raw, fmt = v
    return np.frombuffer(raw, dtype={'f': '<f4', 'd': '<f8', 'l': '<i8', 'i': '<i4', 'b': '?'}[t])


def props70(n):
    out = {}
    for p in ch(n, 'Properties70'):
        for c in p['children']:
            pr = c['props']; out[pr[0]] = pr[4:]
    return out


# ---------- 연결 그래프 ----------
parent, geo_of = {}, {}
mats_of = collections.defaultdict(list)          # model -> [material id] (연결 순서 = 재질 인덱스)
tex_of = collections.defaultdict(dict)           # material -> {slot: texture id}
video_of = {}                                    # texture -> video id
for c in top['Connections']['children']:
    p = c['props']
    a, b = byid.get(p[1]), byid.get(p[2])
    if a is None: continue
    if p[0] == 'OO':
        if a['name'] == 'Model' and (b is None or b['name'] == 'Model'): parent[p[1]] = p[2]
        elif a['name'] == 'Geometry' and b is not None and b['name'] == 'Model': geo_of[p[2]] = p[1]
        elif a['name'] == 'Material' and b is not None and b['name'] == 'Model': mats_of[p[2]].append(p[1])
        elif a['name'] == 'Video' and b is not None and b['name'] == 'Texture': video_of[p[2]] = p[1]
    elif p[0] == 'OP' and a['name'] == 'Texture' and b is not None and b['name'] == 'Material':
        tex_of[p[2]][p[3]] = p[1]


def euler(r):
    rx, ry, rz = [math.radians(x) for x in r]
    X = np.array([[1, 0, 0], [0, math.cos(rx), -math.sin(rx)], [0, math.sin(rx), math.cos(rx)]])
    Y = np.array([[math.cos(ry), 0, math.sin(ry)], [0, 1, 0], [-math.sin(ry), 0, math.cos(ry)]])
    Z = np.array([[math.cos(rz), -math.sin(rz), 0], [math.sin(rz), math.cos(rz), 0], [0, 0, 1]])
    return Z @ Y @ X


def local(m):
    p = props70(m)
    M = np.eye(4)
    M[:3, :3] = euler(p.get('PreRotation', [0, 0, 0])) @ euler(p.get('Lcl Rotation', [0, 0, 0])) @ np.diag(p.get('Lcl Scaling', [1, 1, 1]))
    M[:3, 3] = p.get('Lcl Translation', [0, 0, 0])
    G = np.eye(4)
    G[:3, :3] = euler(p.get('GeometricRotation', [0, 0, 0])) @ np.diag(p.get('GeometricScaling', [1, 1, 1]))
    G[:3, 3] = p.get('GeometricTranslation', [0, 0, 0])
    return M, G


def world(mid):
    M, _ = local(byid[mid])
    pid = parent.get(mid, 0)
    return world(pid) @ M if pid and pid in byid else M


def layer(g, kind, idx_poly_vertex, n_poly_of_pv, comps):
    """LayerElement → polygon-vertex 단위 배열."""
    L = ch(g, kind)
    if not L: return None
    L = L[0]
    data = arr(ch(L, {'LayerElementNormal': 'Normals', 'LayerElementUV': 'UV'}[kind])[0]['props'][0]).astype(np.float64).reshape(-1, comps)
    mapping = ch(L, 'MappingInformationType')[0]['props'][0]
    ref = ch(L, 'ReferenceInformationType')[0]['props'][0]
    if ref == 'IndexToDirect':
        key = {'LayerElementNormal': 'NormalsIndex', 'LayerElementUV': 'UVIndex'}[kind]
        ii = arr(ch(L, key)[0]['props'][0])
    else:
        ii = None
    if mapping == 'ByPolygonVertex':
        sel = ii if ii is not None else np.arange(len(idx_poly_vertex))
    elif mapping in ('ByVertex', 'ByVertice'):
        sel = ii[idx_poly_vertex] if ii is not None else idx_poly_vertex
    elif mapping == 'ByPolygon':
        sel = ii[n_poly_of_pv] if ii is not None else n_poly_of_pv
    else:
        sel = np.zeros(len(idx_poly_vertex), int)
    return data[sel]


# ---------- 지오메트리 ----------
meshes = []
all_pos = []
for o in objs:
    if o['name'] != 'Model' or o['props'][2] != 'Mesh': continue
    mid, name = o['props'][0], nm(o)
    if name in EXCLUDE or mid not in geo_of: continue
    g = byid[geo_of[mid]]
    v = arr(ch(g, 'Vertices')[0]['props'][0]).astype(np.float64).reshape(-1, 3)
    raw = arr(ch(g, 'PolygonVertexIndex')[0]['props'][0]).astype(np.int64)
    real = np.where(raw < 0, ~raw, raw)
    ends = np.where(raw < 0)[0]
    starts = np.r_[0, ends[:-1] + 1]
    poly_of_pv = np.repeat(np.arange(len(ends)), ends - starts + 1)

    W = world(mid) @ local(o)[1]
    W[:3, :] *= 0.01                                 # cm → m
    pos_pv = (np.c_[v[real], np.ones(len(real))] @ W.T)[:, :3]
    nrm = layer(g, 'LayerElementNormal', real, poly_of_pv, 3)
    N3 = np.linalg.inv(W[:3, :3]).T
    if nrm is not None:
        nrm = nrm @ N3.T
        nrm /= np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-12
    uv = layer(g, 'LayerElementUV', real, poly_of_pv, 2)
    flip = np.linalg.det(W[:3, :3]) < 0

    # 재질 인덱스(폴리곤 단위)
    ml = ch(g, 'LayerElementMaterial')
    if ml and ch(ml[0], 'MappingInformationType')[0]['props'][0] == 'ByPolygon':
        pmat = arr(ch(ml[0], 'Materials')[0]['props'][0]).astype(int)
    else:
        pmat = np.zeros(len(ends), int)

    # 팬 삼각분할 (polygon-vertex 인덱스)
    tris, tmat = [], []
    for k, (s, e) in enumerate(zip(starts, ends)):
        for j in range(s + 1, e):
            tris.append((s, j + 1, j) if flip else (s, j, j + 1)); tmat.append(pmat[k])
    tris, tmat = np.array(tris), np.array(tmat)
    meshes.append(dict(name=name, mids=mats_of[mid], pos=pos_pv, nrm=nrm, uv=uv, tris=tris, tmat=tmat))
    all_pos.append(pos_pv)

P = np.concatenate(all_pos)
center = np.array([(P[:, 0].min() + P[:, 0].max()) / 2, P[:, 1].min(), (P[:, 2].min() + P[:, 2].max()) / 2])
for m in meshes: m['pos'] = m['pos'] - center
P = P - center
bbox = (P.min(0), P.max(0))
print('bbox m', np.round(bbox[0], 2), np.round(bbox[1], 2))


def floor_label(name):
    mm = re.match(r'GM_SS_(\d+)F', name)
    if mm:
        f = int(mm.group(1))
        return f'{f}F'
    return 'skin'   # 6~11F 를 관통하는 창호·구조 외피


# ---------- 텍스처 ----------
def video_bytes(vid):
    c = ch(byid[vid], 'Content')
    return c[0]['props'][0] if c and isinstance(c[0]['props'][0], bytes) else None


def external_path(vid):
    for key in ('FileName', 'Filename', 'RelativeFilename'):
        c = ch(byid[vid], key)
        if c and c[0]['props'] and isinstance(c[0]['props'][0], str):
            base = c[0]['props'][0].replace('\\', '/').split('/')[-1].lower()
            if base in tex_files: return tex_files[base]
    return None


missing = set()


def load_img(tid):
    vid = video_of.get(tid)
    b = video_bytes(vid) if vid else None
    if not b and vid:
        path = external_path(vid)
        if path: b = open(path, 'rb').read()
        else: missing.add(nm(byid[vid]))
    if not b: return None
    im = Image.open(io.BytesIO(b))
    im.load()
    if max(im.size) > MAX_TEX:
        s = MAX_TEX / max(im.size)
        im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    return im


images, textures = [], []
img_cache = {}


def add_image(key, im, kind):
    if key in img_cache: return img_cache[key]
    buf = io.BytesIO()
    if kind == 'jpeg':
        im.convert('RGB').save(buf, 'JPEG', quality=88, optimize=True); mime = 'image/jpeg'
    else:
        im.save(buf, 'PNG', optimize=True); mime = 'image/png'
    images.append((buf.getvalue(), mime))
    textures.append({'source': len(images) - 1, 'sampler': 0})
    img_cache[key] = len(textures) - 1
    return img_cache[key]


materials, mat_index = [], {}
for mid in sorted({x for m in meshes for x in m['mids']}, key=lambda i: nm(byid[i])):
    mo = byid[mid]; name = nm(mo); p = props70(mo); slots = tex_of.get(mid, {})
    diff = list(p.get('DiffuseColor', [0.8, 0.8, 0.8]))
    pbr = {'metallicFactor': 0.0, 'roughnessFactor': 0.85}
    mat = {'name': name, 'pbrMetallicRoughness': pbr, 'doubleSided': True}
    if 'DiffuseColor' in slots:
        im = load_img(slots['DiffuseColor'])
        if im is not None:
            pbr['baseColorTexture'] = {'index': add_image(('c', slots['DiffuseColor']), im, 'jpeg')}
            diff = [1, 1, 1]
    pbr['baseColorFactor'] = [float(x) for x in diff] + [1.0]
    if 'NormalMap' in slots:
        im = load_img(slots['NormalMap'])
        if im is not None:
            mat['normalTexture'] = {'index': add_image(('n', slots['NormalMap']), im, 'jpeg')}
    r_id, m_id = slots.get('ShininessExponent'), slots.get('ReflectionFactor')
    if r_id or m_id:
        r = load_img(r_id) if r_id else None
        mt = load_img(m_id) if m_id else None
        size = (r or mt).size
        R = r.convert('L').resize(size) if r else Image.new('L', size, 200)
        M = mt.convert('L').resize(size) if mt else Image.new('L', size, 0)
        orm = Image.merge('RGB', (Image.new('L', size, 255), R, M))
        pbr['metallicRoughnessTexture'] = {'index': add_image(('orm', r_id, m_id), orm, 'png')}
        pbr['metallicFactor'] = 1.0; pbr['roughnessFactor'] = 1.0
    # 재질별 보정 — 원본 Phong 값은 PBR 로 1:1 대응되지 않는다
    low = name.lower()
    if 'metal' in low:
        pbr.update(metallicFactor=0.85, roughnessFactor=0.38)
    if low in ('glass', 'gm_glass_middle'):
        pbr.update(metallicFactor=0.0, roughnessFactor=0.06)
        pbr['baseColorFactor'][3] = 0.42
        mat['alphaMode'] = 'BLEND'
    if low == 'm_windowframe':
        pbr.update(metallicFactor=0.6, roughnessFactor=0.45)
    materials.append(mat)
    mat_index[mid] = len(materials) - 1

# ---------- GLB 조립 ----------
bin_chunks, accessors, views = [], [], []


def push(data, target=None, comp=5126, typ='VEC3', minmax=False):
    data = np.ascontiguousarray(data)
    off = sum(len(b) for b in bin_chunks)
    raw = data.tobytes(); pad = (-len(raw)) % 4
    bin_chunks.append(raw + b'\0' * pad)
    v = {'buffer': 0, 'byteOffset': off, 'byteLength': len(raw)}
    if target: v['target'] = target
    views.append(v)
    a = {'bufferView': len(views) - 1, 'componentType': comp, 'count': len(data), 'type': typ}
    if minmax:
        a['min'] = data.min(0).tolist(); a['max'] = data.max(0).tolist()
    accessors.append(a)
    return len(accessors) - 1


gl_meshes, gl_nodes = [], []
tri_total = 0
for m in meshes:
    prims = []
    for local_mi in np.unique(m['tmat']):
        sel = m['tris'][m['tmat'] == local_mi]
        used, inv = np.unique(sel.reshape(-1), return_inverse=True)
        attrs = {'POSITION': push(m['pos'][used].astype(np.float32), 34962, minmax=True)}
        if m['nrm'] is not None: attrs['NORMAL'] = push(m['nrm'][used].astype(np.float32), 34962)
        if m['uv'] is not None:
            uv = m['uv'][used].astype(np.float32).copy(); uv[:, 1] = 1 - uv[:, 1]
            attrs['TEXCOORD_0'] = push(uv, 34962, typ='VEC2')
        idx = inv.astype(np.uint32)
        prim = {'attributes': attrs, 'indices': push(idx, 34963, comp=5125, typ='SCALAR')}
        if local_mi < len(m['mids']): prim['material'] = mat_index[m['mids'][local_mi]]
        prims.append(prim)
        tri_total += len(sel)
    gl_meshes.append({'name': m['name'], 'primitives': prims})
    ys = m['pos'][:, 1]
    gl_nodes.append({'name': m['name'], 'mesh': len(gl_meshes) - 1,
                     'extras': {'floor': floor_label(m['name']), 'yMin': float(ys.min()), 'yMax': float(ys.max()),
                                'part': nm(byid[m['mids'][0]]) if m['mids'] else ''}})

for data, mime in images:
    off = sum(len(b) for b in bin_chunks); pad = (-len(data)) % 4
    bin_chunks.append(data + b'\0' * pad)
    views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(data)})
gl_images = [{'bufferView': len(views) - len(images) + i, 'mimeType': mime} for i, (_, mime) in enumerate(images)]

sha = hashlib.sha256(open(SRC, 'rb').read()).hexdigest()
binary = b''.join(bin_chunks)
gltf = {
    'asset': {'version': '2.0', 'generator': 'supreme-origin fbx2glb', 'extras': {'sourceSha256': sha}},
    'scene': 0, 'scenes': [{'name': os.path.splitext(os.path.basename(SRC))[0], 'nodes': list(range(len(gl_nodes)))}],
    'nodes': gl_nodes, 'meshes': gl_meshes, 'materials': materials,
    'textures': textures, 'images': gl_images,
    'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}],
    'accessors': accessors, 'bufferViews': views, 'buffers': [{'byteLength': len(binary)}],
}
js = json.dumps(gltf, separators=(',', ':')).encode()
js += b' ' * ((-len(js)) % 4)
with open(OUT, 'wb') as f:
    f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(binary)))
    f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
    f.write(struct.pack('<II', len(binary), 0x004E4942)); f.write(binary)
if missing: print('텍스처를 찾지 못함:', sorted(missing))
print(f'meshes {len(gl_meshes)} tris {tri_total} materials {len(materials)} images {len(images)} '
      f'glb {len(js) + len(binary):,} bytes sha {sha[:12]}')
