// Ground polygons clipped by linear half-planes, including a perspective frustum at the horizon.
export function clipGround(width, depth, planes) {
  let polygon = [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: depth }, { x: 0, y: depth }];
  return clipPolygon(polygon, planes);
}

export function clipPolygon(polygon, planes) {
  for (const distance of planes) {
    const next = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length], da = distance(a), db = distance(b);
      if (da >= 0) next.push(a);
      if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); next.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }); }
    }
    polygon = next;
  }
  return polygon;
}

export function overviewTransform(width, depth, degrees, w = 180, h = 110) {
  const a = degrees * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const scale = Math.min((w - 12) / (Math.abs(c) * width + Math.abs(s) * depth), (h - 12) / (Math.abs(s) * width + Math.abs(c) * depth));
  return {
    project: (x, y) => ({ x: w / 2 + scale * (c * (x - width / 2) - s * (y - depth / 2)), y: h / 2 + scale * (s * (x - width / 2) + c * (y - depth / 2)) }),
    inverse: (x, y) => ({ x: width / 2 + (c * (x - w / 2) + s * (y - h / 2)) / scale, y: depth / 2 + (-s * (x - w / 2) + c * (y - h / 2)) / scale }),
  };
}
