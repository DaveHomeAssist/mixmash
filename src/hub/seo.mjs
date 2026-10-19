/** Search and share metadata derived from the public catalog. No claim here is new: names, genres
 *  and descriptions come from catalog.mjs (backed by docs/HOMEPAGE_EVIDENCE.md). */
import { playableGames, studio } from './catalog.mjs';
export const SITE = 'https://mixmash.games';
/** 1200x630 share card per game, generated from its gameplay preview by `npm run hub:og`. */
export const ogImage = id => `${SITE}/assets/og/${id}.jpg`;
export function gameLd(game) {
  return {
    '@type': 'VideoGame',
    name: game.name,
    url: `${SITE}${game.route}`,
    description: game.description,
    genre: game.genre,
    image: ogImage(game.id),
    gamePlatform: 'Web browser',
    applicationCategory: 'Game',
    operatingSystem: 'Any',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    publisher: { '@type': 'Organization', name: 'MixMash Studio', url: `${SITE}/` }
  };
}
/** JSON-LD for the homepage: the site, the studio and the playable lineup. `<` is escaped so the
 *  block can never close its own script element. */
export function structuredData() {
  const graph = [
    { '@type': 'WebSite', '@id': `${SITE}/#website`, name: 'MixMash Studio', url: `${SITE}/`, description: studio.description, inLanguage: 'en' },
    { '@type': 'Organization', '@id': `${SITE}/#studio`, name: 'MixMash Studio', url: `${SITE}/`, logo: `${SITE}/favicon.svg`, sameAs: ['https://github.com/DaveHomeAssist/mixmash'] },
    { '@type': 'ItemList', name: 'MixMash Studio games', numberOfItems: playableGames.length, itemListElement: playableGames.map((game, index) => ({ '@type': 'ListItem', position: index + 1, item: gameLd(game) })) }
  ];
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replaceAll('<', '\\u003c');
}
