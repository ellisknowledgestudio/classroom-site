#!/usr/bin/env python3
"""Turn Natural Earth's 110m land outlines (public domain) into the `shapes` list for
space/assets/bodies/earth.js.

Usage:  python3 tools/space/make-earth-land.py path/to/ne_110m_land.geojson
Source: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson

Prints one JavaScript line per shape: {points:[lon,lat,lon,lat,...]}. Small islands are dropped and
coastlines are simplified so the body file stays small. Ice-covered land gets a white colour.
"""
import json, sys

TOLERANCE = 0.6     # degrees; bigger = fewer points
MIN_AREA = 3.0      # square degrees; smaller islands are left out
ICE = '#EEF3F8'

def area(ring):
    return abs(sum(ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1] for i in range(len(ring) - 1))) / 2

def simplify(pts, tol):
    if len(pts) < 3:
        return pts
    (x1, y1), (x2, y2) = pts[0], pts[-1]
    dx, dy = x2 - x1, y2 - y1
    norm = (dx * dx + dy * dy) ** 0.5 or 1e-12
    best, where = 0, 0
    for i in range(1, len(pts) - 1):
        d = abs(dy * (pts[i][0] - x1) - dx * (pts[i][1] - y1)) / norm
        if d > best:
            best, where = d, i
    if best <= tol:
        return [pts[0], pts[-1]]
    return simplify(pts[:where + 1], tol)[:-1] + simplify(pts[where:], tol)

def main(path):
    rings = []
    for f in json.load(open(path))['features']:
        g = f['geometry']
        polys = [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']
        rings += [p[0] for p in polys]
    rings.sort(key=area, reverse=True)
    for ring in rings:
        if area(ring) < MIN_AREA:
            continue
        half = len(ring) // 2          # simplify in two halves so a closed ring keeps its shape
        pts = simplify(ring[:half + 1], TOLERANCE)[:-1] + simplify(ring[half:], TOLERANCE)[:-1]
        if len(pts) < 3:
            continue
        lats = [p[1] for p in pts]; lons = [p[0] for p in pts]
        centre_lat, centre_lon = sum(lats) / len(lats), sum(lons) / len(lons)
        icy = centre_lat < -60 or (centre_lat > 66 and -75 < centre_lon < -15 and area(ring) > 400)
        flat = ','.join('%g,%g' % (round(x, 1), round(y, 1)) for x, y in pts)
        print("          {%spoints:[%s]}," % ("colour:'%s'," % ICE if icy else '', flat))

if __name__ == '__main__':
    main(sys.argv[1])
