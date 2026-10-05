/** Generate the complete static homepage from the catalog. --check refuses drift. */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { playableGames, studio } from './catalog.mjs';
const root = new URL('../../', import.meta.url);
const escape = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const picture = (game, eager = false) => `<img src="/assets/previews/${escape(game.image)}" width="1000" height="650" alt="${escape(game.alt)}" decoding="async"${eager ? ' fetchpriority="high"' : ' loading="lazy"'}>`;
const cards = playableGames.map((g, i) => `
<article class="game-card ${g.accent}" data-game="${g.id}" aria-labelledby="title-${g.id}">
  <div class="game-vis">${picture(g, i === 0)}<span class="ticket-number" aria-hidden="true">MM / ${String(i + 1).padStart(2, '0')}</span></div>
  <div class="game-body"><p class="game-genre">${escape(g.genre)}</p><h3 id="title-${g.id}"><a class="details-link" id="details-${g.id}" href="#game-${g.id}" aria-label="View details: ${escape(g.name)}">${escape(g.name)}</a></h3><p class="game-hook">${escape(g.hook)}</p><p class="game-status">${escape(g.status)}</p></div>
  <a class="play-link" href="${g.route}" aria-label="${escape(g.action)}: ${escape(g.name)}"><span>${g.action}</span><span aria-hidden="true">↗</span></a>
</article>`).join('\n');
const details = playableGames.map(g => `
<section class="view detail-view ${g.accent}" id="game-${g.id}" aria-labelledby="heading-${g.id}" data-game-detail="${g.id}">
  <div class="detail-top"><a class="button back-link" href="#games">← Back to games</a><span class="game-status">${escape(g.status)}</span></div>
  <div class="detail-body"><div class="detail-art">${picture(g)}<span class="detail-stamp" aria-hidden="true">ADMIT ONE<br>FREE TO PLAY</span></div>
    <div class="detail-copy" role="region" aria-label="${escape(g.name)} details" tabindex="0" data-web2-scroll><p class="eyebrow">${escape(g.genre)}</p><h2 id="heading-${g.id}" tabindex="-1">${escape(g.name)}</h2><p class="detail-hook">${escape(g.hook)}</p><p>${escape(g.description)}</p>
    <dl><div><dt>Players</dt><dd>${escape(g.players)}</dd></div><div><dt>Controls</dt><dd>${escape(g.controls)}</dd></div></dl><h3>Saving progress</h3><p>${escape(g.saving)}</p><div class="related-links">${g.related.map(link => `<a href="${escape(link.href)}">${escape(link.title)} ↗</a>`).join('')}</div></div>
  </div><div class="detail-actions"><a class="button primary" href="${g.route}" aria-label="${escape(g.action)}: ${escape(g.name)}">${escape(g.action)} <span aria-hidden="true">↗</span></a><a class="button" href="https://github.com/DaveHomeAssist/mixmash/issues/new">Send feedback <span class="sr-only"> (external GitHub site, account required)</span><span aria-hidden="true">↗</span></a></div>
</section>`).join('\n');
let html = await readFile(new URL('template.html', import.meta.url), 'utf8');
for (const [key, value] of Object.entries({ TITLE: escape(studio.title), DESCRIPTION: escape(studio.description), INTRO: escape(studio.intro), COUNT: playableGames.length, NOTE: escape(studio.note), CARDS: cards, DETAILS: details })) html = html.replaceAll(`{{${key}}}`, String(value));
if (html.includes('{{')) throw new Error('Unresolved homepage template marker');
const destination = new URL('index.html', root);
if (process.argv.includes('--check')) {
  if (await readFile(destination, 'utf8') !== html) throw new Error('Homepage catalog drift. Run npm run hub:build.');
  console.log('Homepage matches catalog and template.');
} else { await writeFile(destination, html); console.log(`Generated ${fileURLToPath(destination)} with ${playableGames.length} playable games.`); }
