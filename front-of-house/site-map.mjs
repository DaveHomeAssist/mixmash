import { OBJECT_TYPES } from './data.mjs';
import { overviewTransform, clipPolygon } from './site-map-geometry.mjs';

export function createSiteMap(element, board, changed) {
  const canvas = element.querySelector('canvas'), ctx = canvas.getContext('2d'), phone = matchMedia('(max-width: 680px)');
  let lastScene = null, wanted = false, transform = null, nav = null, key = '', draws = 0, pointer = null;
  function hide() { element.hidden = true; if (document.activeElement === canvas) document.querySelector('#board').focus({ preventScroll: true }); }
  function layout() {
    if (!wanted) { hide(); return; }
    element.hidden = false;
    const { width, height } = element.getBoundingClientRect(), top = document.querySelector('.topbar').getBoundingClientRect().bottom + 12;
    const obstacles = [...document.querySelectorAll('#panel .plate, #panel .at-sheet')].filter(e => e.getClientRects().length).map(e => e.getBoundingClientRect());
    for (const x of [12, innerWidth - width - 12]) {
      const spans = obstacles.filter(r => r.left < x + width + 8 && r.right > x - 8).map(r => [r.top - 8, r.bottom + 8]).sort((a, b) => a[0] - b[0]);
      let y = top; const gaps = [];
      for (const [a, b] of spans) { if (a > y) gaps.push([y, a]); y = Math.max(y, b); }
      if (y < innerHeight - 12) gaps.push([y, innerHeight - 12]);
      const gap = gaps.filter(([a, b]) => b - a >= height).sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]))[0];
      if (gap) { element.style.left = `${x}px`; element.style.top = `${Math.round((gap[0] + gap[1] - height) / 2)}px`; return; }
    }
    hide();
  }
  function polygon(points, fill, stroke) {
    if (!points.length) return;
    ctx.beginPath(); points.forEach((p, i) => { const q = transform.project(p.x, p.y); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); }); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  const box = (x, y, w, h, fill, stroke) => polygon([{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }], fill, stroke);
  function update(scene) {
    lastScene = scene;
    const allow = scene.floor === 'festival' && !phone.matches && board.camera().zoom > 1;
    if (allow !== wanted) { wanted = allow; layout(); }
    if (element.hidden) return;
    nav = board.navigation();
    const next = JSON.stringify([nav, board.camera(), scene.objects, scene.night, scene.crowd, document.documentElement.dataset.theme, devicePixelRatio]);
    if (next === key) return;
    key = next; draws++;
    const dpr = Math.max(1, Math.min(2, devicePixelRatio || 1)); canvas.width = Math.round(180 * dpr); canvas.height = Math.round(110 * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    transform = overviewTransform(nav.width, nav.depth, nav.rotation);
    ctx.lineWidth = 1; ctx.fillStyle = '#111923'; ctx.fillRect(0, 0, 180, 110);
    box(0, 0, scene.grid.w, scene.grid.h, scene.night && scene.crowd ? '#436c66' : '#354451', '#92a4b5');
    for (const r of nav.fixed || []) box(r.x, r.y, r.w, r.h, r.kind === 'stage' ? '#efc464' : scene.night && scene.stageAudience?.second ? '#436c66' : '#6c6350', '#d0ba80');
    for (const o of scene.objects) { const d = OBJECT_TYPES[o.type]; if (d) box(o.x, o.y, o.rot % 2 ? d.h : d.w, o.rot % 2 ? d.w : d.h, o.type === 'stage' ? '#efc464' : '#c8d3dd'); }
    ctx.lineWidth = 2;
    for (const r of [{ x: 0, y: 0, w: scene.grid.w, h: scene.grid.h }, ...(nav.fixed || []).filter(r => r.kind === 'ground')]) polygon(clipPolygon(nav.footprint, [p => p.x - r.x, p => r.x + r.w - p.x, p => p.y - r.y, p => r.y + r.h - p.y]), 'rgba(255,255,255,.12)', '#ffffff');
    const c = board.camera(), p = transform.project(c.x, c.y); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  function move(event) {
    if (!transform || !nav) return;
    const r = canvas.getBoundingClientRect(), p = transform.inverse((event.clientX - r.left) * 180 / r.width, (event.clientY - r.top) * 110 / r.height);
    if (p.x < 0 || p.y < 0 || p.x > nav.width || p.y > nav.depth) return;
    board.panTo(p.x, p.y); changed();
  }
  function down(event) { if (event.button !== 0 || element.hidden) return; event.preventDefault(); event.stopPropagation(); canvas.focus({ preventScroll: true }); pointer = event.pointerId; canvas.setPointerCapture(pointer); move(event); }
  function drag(event) { if (event.pointerId !== pointer) return; event.preventDefault(); event.stopPropagation(); move(event); }
  function up(event) { if (event.pointerId !== pointer) return; if (canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer); pointer = null; }
  function keys(event) {
    const deltas = { ArrowLeft: [-8, 0], ArrowRight: [8, 0], ArrowUp: [0, -8], ArrowDown: [0, 8] };
    if (!deltas[event.key] && !['Home', 'Escape', 'Enter', ' '].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    if (event.key === 'Home') board.zoomTo(1);
    else if (event.key === 'Escape') document.querySelector('#board').focus({ preventScroll: true });
    else if (deltas[event.key] && transform) { const c = board.camera(), p = transform.project(c.x, c.y), d = deltas[event.key], q = transform.inverse(p.x + d[0], p.y + d[1]); board.panTo(q.x, q.y); }
    else if (nav) board.panTo(nav.width / 2, nav.depth / 2);
    changed();
  }
  const handlers = { pointerdown: down, pointermove: drag, pointerup: up, pointercancel: up, keydown: keys };
  for (const [name, fn] of Object.entries(handlers)) canvas.addEventListener(name, fn);
  return { update, layout, refresh: () => { if (lastScene) update(lastScene); }, info: () => ({ visible: !element.hidden, draws, navigation: nav, footprint: nav?.footprint || [] }), destroy: () => { for (const [name, fn] of Object.entries(handlers)) canvas.removeEventListener(name, fn); hide(); } };
}
