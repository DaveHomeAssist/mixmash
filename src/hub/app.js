/** Progressive homepage navigation, theme and short-screen pagination. Never touches game saves. */
const root = document.documentElement;
const views = [...document.querySelectorAll('.view')];
const grid = document.getElementById('games-grid');
const cards = [...grid.querySelectorAll('.game-card')];
const nav = [...document.querySelectorAll('.site-nav a')];
const themeButton = document.getElementById('theme-toggle');
const pager = document.getElementById('pager');
const announcement = document.getElementById('announcement');
let pageIndex = 0;
let capacity = cards.length;
let previousPick = '';
let lastDetail = '';
let currentView = '';
const stored = key => { try { return localStorage.getItem(`mixmash.hub.${key}`); } catch { return null; } };
function save(key, value) { try { localStorage.setItem(`mixmash.hub.${key}`, value); } catch { /* Private browsing still supports this visit. */ } }
// "Continue": game pages record mm.lastGame = {slug, t} (assets/last-game.js). Fresh, known entries tag
// that card; anything malformed, unknown or older than 14 days is deleted and ignored. Cards never reorder.
const LAST_GAME_KEY = 'mm.lastGame';
const LAST_GAME_MAX_AGE = 14 * 24 * 60 * 60 * 1000;
function readLastGame() {
  let raw = null;
  try { raw = localStorage.getItem(LAST_GAME_KEY); } catch { return ''; }
  if (raw === null) return '';
  let entry = null;
  try { entry = JSON.parse(raw); } catch { /* deleted below */ }
  const age = entry && Number.isFinite(entry.t) ? Date.now() - entry.t : NaN;
  const known = entry && typeof entry.slug === 'string' && cards.some(card => card.dataset.game === entry.slug);
  // Allow a minute of clock skew; a timestamp further in the future is not trustworthy.
  if (known && age > -60000 && age < LAST_GAME_MAX_AGE) return entry.slug;
  try { localStorage.removeItem(LAST_GAME_KEY); } catch { /* Nothing else to clean up. */ }
  return '';
}
function recordLastGame(slug) { try { localStorage.setItem(LAST_GAME_KEY, JSON.stringify({ slug, t: Date.now() })); } catch { /* Storage blocked. */ } }
const lastGame = readLastGame();
const lastCard = cards.find(card => card.dataset.game === lastGame);
if (lastCard) {
  lastCard.classList.add('is-last-played');
  const tag = document.createElement('span');
  tag.className = 'continue-tag'; tag.id = `continue-${lastGame}`; tag.textContent = 'Continue';
  lastCard.append(tag);
  for (const link of lastCard.querySelectorAll('.details-link,.play-link')) link.setAttribute('aria-describedby', tag.id);
}
// Games that cannot include the marker script (EMPIRES) are recorded when launched from here.
const routeSlugs = new Map(cards.map(card => [new URL(card.querySelector('.play-link').href).pathname, card.dataset.game]));
document.addEventListener('click', event => {
  const link = event.target.closest?.('a[href]');
  if (!link || link.origin !== location.origin) return;
  const slug = routeSlugs.get(link.pathname);
  if (slug === 'empires') recordLastGame(slug);
});
function setTheme(theme) {
  root.dataset.theme = theme;
  themeButton.textContent = theme === 'light' ? 'Dark mode' : 'Light mode';
  themeButton.setAttribute('aria-label', `Switch to ${theme === 'light' ? 'dark' : 'light'} mode`);
  document.querySelector('meta[name="theme-color"]').content = theme === 'light' ? '#f5f1e7' : '#171a19';
}
setTheme(stored('theme') === 'dark' ? 'dark' : 'light');
themeButton.hidden = false;
themeButton.addEventListener('click', () => { setTheme(root.dataset.theme === 'light' ? 'dark' : 'light'); save('theme', root.dataset.theme); });
function fitCatalog() {
  if (currentView !== 'games') return;
  const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
  const short = innerHeight <= 400;
  // Under 850px tall, wider screenshot crops let the full lineup fit before pagination is considered.
  const compact = innerHeight < 850;
  const minimum = short ? 68 : innerWidth <= 700 ? 76 : compact ? 150 : 220;
  const gap = parseFloat(getComputedStyle(grid).rowGap) || 0;
  // First measure with the pager reserved, then remove it if every game fits without it.
  pager.hidden = false;
  const rowsWithPager = Math.max(1, Math.floor((grid.clientHeight - 12 + gap) / (minimum + gap)));
  pager.hidden = true;
  const rowsWithoutPager = Math.max(1, Math.floor((grid.clientHeight - 12 + gap) / (minimum + gap)));
  const allFit = rowsWithoutPager * columns >= cards.length;
  const rows = allFit ? Math.ceil(cards.length / columns) : rowsWithPager;
  capacity = Math.min(cards.length, rows * columns);
  const total = Math.ceil(cards.length / capacity);
  pageIndex = Math.max(0, Math.min(pageIndex, total - 1));
  pager.hidden = total <= 1;
  grid.style.setProperty('--rows', Math.min(rows, Math.ceil(cards.length / columns)));
  cards.forEach((card, index) => { card.hidden = index < pageIndex * capacity || index >= (pageIndex + 1) * capacity; });
  document.getElementById('page-count').textContent = `${pageIndex + 1} / ${total} · ${cards.length} games`;
  document.getElementById('previous-page').disabled = pageIndex === 0;
  document.getElementById('next-page').disabled = pageIndex === total - 1;
}
function changePage(direction) {
  pageIndex += direction; fitCatalog();
  cards.find(card => !card.hidden)?.querySelector('.details-link').focus();
}
document.getElementById('previous-page').addEventListener('click', () => changePage(-1));
document.getElementById('next-page').addEventListener('click', () => changePage(1));
function updateSpotlight(card) {
  const image = card.querySelector('img');
  const link = card.querySelector('.play-link');
  const title = card.querySelector('h3').textContent;
  const preview = document.getElementById('spotlight-image');
  preview.src = image.src; preview.alt = image.alt;
  document.getElementById('spotlight-title').textContent = title;
  document.getElementById('spotlight-genre').textContent = card.querySelector('.game-genre').textContent;
  document.getElementById('spotlight-copy').textContent = card.querySelector('.game-hook').textContent;
  const play = document.getElementById('spotlight-play'); play.href = link.href; play.textContent = `Play ${title} ↗`;
}
for (const card of cards) {
  card.addEventListener('focusin', () => updateSpotlight(card));
  card.addEventListener('pointerenter', () => updateSpotlight(card));
}
function showView(moveFocus = true) {
  const requested = location.hash.slice(1) || 'games';
  const target = views.find(view => view.id === requested) || views[0];
  const leaving = currentView;
  currentView = target.id;
  if (currentView.startsWith('game-')) lastDetail = currentView.slice(5);
  views.forEach(view => { view.hidden = view !== target; });
  document.getElementById('intro').hidden = currentView !== 'games';
  nav.forEach(link => {
    const selected = currentView === 'studio' ? link.hash === '#studio' : link.hash === '#games';
    link.setAttribute('aria-selected', String(selected)); link.tabIndex = selected ? 0 : -1;
  });
  if (currentView === 'games') {
    // A direct detail visit has not measured the catalog yet. Resolve capacity first.
    fitCatalog();
    if (lastDetail) {
      pageIndex = Math.floor(cards.findIndex(card => card.dataset.game === lastDetail) / capacity);
      fitCatalog();
    }
    if (moveFocus && leaving.startsWith('game-')) document.getElementById(`details-${lastDetail}`)?.focus();
  } else {
    if (moveFocus) target.querySelector('h2')?.focus({ preventScroll: true });
    restoreScroll(target);
  }
}
// Layout-dependent work (catalog capacity, scroll restore) must run against styled layout. WebKit can run
// this module before the render-blocking stylesheet applies (slow network, busy device): no panel is a
// scroll container yet, so a restored scrollTop clamps to 0 and the catalog measures an unstyled grid.
// Anything measured too early is redone once the stylesheet and then the page finish loading.
let restorePending = '';
function restoreScroll(target) {
  const wanted = Number(stored(`scroll.${target.id}`)) || 0;
  const panels = [...target.querySelectorAll('[data-web2-scroll]')];
  const panel = panels.find(element => element.scrollHeight > element.clientHeight && getComputedStyle(element).overflowY === 'auto') || panels[0];
  if (!panel) return;
  panel.scrollTop = wanted;
  restorePending = panel.scrollTop < wanted - 1 && document.readyState !== 'complete' ? target.id : '';
}
function relayout() {
  fitCatalog();
  // Re-read storage: a scroll the visitor made meanwhile was saved and wins over the original position.
  if (restorePending && restorePending === currentView) restoreScroll(document.getElementById(restorePending));
  if (document.readyState === 'complete') restorePending = '';
}
const hubStyles = document.querySelector('link[rel="stylesheet"][href$="/src/hub/style.css"]');
if (hubStyles && !hubStyles.sheet) hubStyles.addEventListener('load', relayout, { once: true });
if (document.readyState !== 'complete') window.addEventListener('load', relayout, { once: true });
for (const link of nav) { link.setAttribute('role', 'tab'); link.setAttribute('aria-controls', link.hash.slice(1)); }
document.querySelector('.site-nav').setAttribute('role', 'tablist');
for (const view of views.filter(view => ['games', 'studio'].includes(view.id))) { view.setAttribute('role', 'tabpanel'); view.setAttribute('aria-labelledby', `nav-${view.id}`); }
document.querySelector('.site-nav').addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const next = event.key === 'Home' ? nav[0] : event.key === 'End' ? nav.at(-1) : nav[(nav.indexOf(document.activeElement) + 1) % nav.length];
  location.hash = next.hash; next.focus();
});
// Keep arrow-key tab activation on the tab. Normal links focus their destination heading.
let tabKeyboard = false;
document.querySelector('.site-nav').addEventListener('keydown', event => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) tabKeyboard = true; });
window.addEventListener('hashchange', () => { showView(!tabKeyboard); tabKeyboard = false; });
window.addEventListener('resize', fitCatalog);
const picker = document.getElementById('pick-game'); picker.hidden = false;
picker.addEventListener('click', () => {
  // Skip the game played last (and the previous pick) while anything else is left to choose.
  const others = cards.filter(card => card.dataset.game !== lastGame);
  const pool = others.length ? others : cards;
  const fresh = pool.filter(card => card.dataset.game !== previousPick);
  const choices = fresh.length ? fresh : pool;
  const bytes = new Uint32Array(1); crypto.getRandomValues(bytes);
  const selected = choices[bytes[0] % choices.length]; previousPick = selected.dataset.game;
  announcement.textContent = `Picked ${selected.querySelector('h3').textContent}. Review its details, then choose Play.`;
  location.hash = `game-${previousPick}`;
});
// Share: the native share sheet where the browser has one, otherwise copy the link. Buttons stay
// hidden without JavaScript, so a no-script visit never shows a control that cannot work.
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* Fall back below. */ }
  const field = document.createElement('textarea');
  field.value = text; field.setAttribute('readonly', ''); field.style.position = 'fixed'; field.style.opacity = '0';
  document.body.append(field); field.select();
  let copied = false; try { copied = document.execCommand('copy'); } catch { copied = false; }
  field.remove(); return copied;
}
async function share(button) {
  const { shareUrl: url, shareTitle: title, shareText: text } = button.dataset;
  if (typeof navigator.share === 'function') {
    try { await navigator.share({ title, text, url }); return; } catch (error) { if (error?.name === 'AbortError') return; }
  }
  const copied = await copyText(url);
  button.dataset.shared = copied ? 'copied' : 'failed';
  announcement.textContent = copied ? `Link copied: ${url}` : `Copy this link: ${url}`;
  const label = button.textContent;
  button.textContent = copied ? 'Link copied' : 'Copy failed';
  setTimeout(() => { button.textContent = label; }, 2000);
}
for (const button of document.querySelectorAll('.share-button')) { button.hidden = false; button.addEventListener('click', () => share(button)); }
for (const image of document.images) {
  image.addEventListener('error', () => image.classList.add('image-failed'));
  if (image.complete && !image.naturalWidth) image.classList.add('image-failed');
}
for (const view of views) {
  for (const panel of view.querySelectorAll('[data-web2-scroll]')) {
    if (view.id !== 'games') panel.addEventListener('scroll', () => save(`scroll.${view.id}`, String(panel.scrollTop)), { passive: true });
  }
}
root.classList.add('enhanced');
showView(false);
