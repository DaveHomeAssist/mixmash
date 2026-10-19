/** Build one 1200x630 share card per game from its live gameplay preview and catalog copy.
 *  Uses assets/previews (real captures), not assets/covers, whose key art carries its own title panel. */
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { playableGames } from './catalog.mjs';
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  for (const game of playableGames) {
    const art = (await readFile(new URL(`../../assets/previews/${game.image}`, import.meta.url))).toString('base64');
    await page.setContent(`<html><head><style>
    *{box-sizing:border-box}body{margin:0;width:1200px;height:630px;position:relative;overflow:hidden;background:#20221f;font-family:Arial,Helvetica,sans-serif;color:#fffcf4}
    img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
    .shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(20,22,20,.94) 0%,rgba(20,22,20,.82) 40%,rgba(20,22,20,.1) 75%)}
    .copy{position:absolute;left:56px;top:56px;bottom:56px;width:560px;display:flex;flex-direction:column;justify-content:space-between}
    .brand{font-weight:800;letter-spacing:.06em;font-size:20px}.brand small{font:14px monospace;opacity:.8;margin-left:10px}
    .genre{font:16px monospace;text-transform:uppercase;letter-spacing:.12em;color:#ffb3c6;margin:0 0 14px}
    h1{font-size:76px;line-height:.95;letter-spacing:-3px;margin:0 0 20px}
    .hook{font-family:Georgia,serif;font-style:italic;font-size:30px;margin:0}
    .foot{display:flex;gap:16px;align-items:center;font:16px monospace}.pill{border:1px solid #fffcf4;border-radius:999px;padding:6px 14px}
    </style></head><body><img src="data:image/jpeg;base64,${art}" alt=""><div class="shade"></div><div class="copy">
    <div class="brand">MIXMASH STUDIO<small>${escape(game.status.toUpperCase())}</small></div>
    <div><p class="genre">${escape(game.genre)}</p><h1>${escape(game.name)}</h1><p class="hook">${escape(game.hook)}</p></div>
    <div class="foot"><span class="pill">Free in your browser</span><strong>mixmash.games${escape(game.route)}</strong></div></div></body></html>`);
    await page.evaluate(() => Promise.all([...document.images].map(img => img.decode())));
    await page.screenshot({ path: new URL(`../../assets/og/${game.id}.jpg`, import.meta.url).pathname, type: 'jpeg', quality: 82 });
  }
} finally { await browser.close(); }
console.log(`Built ${playableGames.length} game share cards (1200 x 630) in assets/og/.`);
