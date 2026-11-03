import struct, zlib


def parse(path):
    data = open(path, 'rb').read()
    ver = struct.unpack_from('<I', data, 23)[0]
    big = ver >= 7500

    def rd_node(off):
        if big:
            end, nprops, plen = struct.unpack_from('<QQQ', data, off); off += 24
        else:
            end, nprops, plen = struct.unpack_from('<III', data, off); off += 12
        if end == 0:
            return None, off + data[off]
        nl = data[off]; off += 1
        name = data[off:off + nl].decode('ascii', 'replace'); off += nl
        props = []
        for _ in range(nprops):
            t = chr(data[off]); off += 1
            if t == 'Y': v = struct.unpack_from('<h', data, off)[0]; off += 2
            elif t == 'C': v = bool(data[off]); off += 1
            elif t == 'I': v = struct.unpack_from('<i', data, off)[0]; off += 4
            elif t == 'F': v = struct.unpack_from('<f', data, off)[0]; off += 4
            elif t == 'D': v = struct.unpack_from('<d', data, off)[0]; off += 8
            elif t == 'L': v = struct.unpack_from('<q', data, off)[0]; off += 8
            elif t in 'fdlib':
                n, enc, cl = struct.unpack_from('<III', data, off); off += 12
                raw = data[off:off + cl]; off += cl
                if enc == 1: raw = zlib.decompress(raw)
                fmt = {'f': 'f', 'd': 'd', 'l': 'q', 'i': 'i', 'b': '?'}[t]
                v = ('ARR', t, n, raw, fmt)
            elif t in 'SR':
                n = struct.unpack_from('<I', data, off)[0]; off += 4
                v = data[off:off + n]; off += n
                if t == 'S': v = v.decode('utf-8', 'replace')
            else:
                raise ValueError(t)
            props.append(v)
        children = []
        nsz = 25 if big else 13
        while off < end:
            if data[off:off + nsz] == b'\0' * nsz:
                off += nsz; break
            c, off = rd_node(off)
            children.append(c)
        return {'name': name, 'props': props, 'children': children}, end

    nodes = []; off = 27
    nsz = 25 if big else 13
    while off < len(data) - nsz:
        if data[off:off + nsz] == b'\0' * nsz: break
        n, off = rd_node(off)
        nodes.append(n)
    return ver, nodes
