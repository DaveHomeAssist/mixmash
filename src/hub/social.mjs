/** Build the studio share image from the same catalog and real gameplay previews. */
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { playableGames } from './catalog.mjs';
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
const tickets = await Promise.all(playableGames.map(async (game, index) => {
  const data = await readFile(new URL(`../../assets/previews/${game.image}`, import.meta.url));
  return `<article><img src="data:image/jpeg;base64,${data.toString('base64')}" alt=""><span>MM / 0${index + 1}</span><h2>${escape(game.name)}</h2><p>${escape(game.status)}</p></article>`;
}));
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(`<html><head><style>
  *{box-sizing:border-box}body{margin:0;padding:30px 38px;background:#f5f1e7;color:#20221f;font-family:Arial,Helvetica,sans-serif}header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #20221f;padding-bottom:14px;font-size:18px;font-weight:800;letter-spacing:.03em}header small{font:12px monospace;letter-spacing:.05em}h1{font-size:48px;letter-spacing:-2px;line-height:1;margin:23px 0}em{font-family:Georgia,serif;font-weight:500;color:#aa2549}main{display:grid;grid-template-columns:repeat(3,1fr);gap:15px}article{position:relative;background:#fffcf4;border:1px solid #b7b9ab;border-radius:8px;overflow:hidden;border-bottom:4px solid #aa2549}img{width:100%;height:116px;object-fit:cover;display:block}article span{position:absolute;top:8px;left:8px;background:#fffcf4;padding:4px 6px;font:9px monospace}h2{font-size:19px;letter-spacing:-.5px;margin:10px 12px 5px}p{font-size:9px;text-transform:uppercase;font-weight:700;color:#aa2549;margin:0 12px 10px}footer{display:flex;justify-content:space-between;font:12px monospace;margin-top:18px}
  </style></head><body><header>MIXMASH STUDIO <small>6 GAMES · ALL FREE</small></header><h1>Small games. <em>Big personality.</em></h1><main>${tickets.join('')}</main><footer><span>Independent games. Open invitation.</span><strong>mixmash.games</strong></footer></body></html>`);
  await page.evaluate(() => Promise.all([...document.images].map(img => img.decode())));
  await page.screenshot({ path: new URL('../../assets/og-card.png', import.meta.url).pathname });
} finally { await browser.close(); }
console.log('Built 1200 × 630 studio share image.');
