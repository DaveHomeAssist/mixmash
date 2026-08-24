import test from 'node:test';
import assert from 'node:assert/strict';
import { hasSprite, spriteIds, spriteHTML, spriteOrEmoji, emojiFor, registerSheet } from './sprites.mjs';
import { ITEMS } from './engine.mjs';

test('the 13 hand-authored sprites render as crisp-edge SVG', () => {
  assert.equal(spriteIds().length, 13);
  for (const id of spriteIds()) {
    const html = spriteHTML(id, 2);
    assert.match(html, /^<svg class="pspr"/, `${id} should render as SVG`);
    assert.match(html, /shape-rendering="crispEdges"/, `${id} should stay pixel-crisp`);
    assert.match(html, /<rect /, `${id} should emit at least one pixel run`);
  }
});

test('every canonical item renders something — a sprite or an emoji, never nothing', () => {
  for (const id of Object.keys(ITEMS)) {
    const html = spriteOrEmoji(id, 2);
    assert.ok(html.length > 0, `${id} rendered nothing`);
    assert.ok(/^<svg|^<span/.test(html), `${id} produced unexpected markup: ${html.slice(0, 40)}`);
  }
});

test('items the port renamed still resolve to their original sprite', () => {
  // The sprite maps predate the port's renames; without aliasing these would
  // silently drop to emoji even though real pixel art exists for them.
  for (const id of ['component', 'advanced_component', 'composite_frame']) {
    assert.equal(hasSprite(id), true, `${id} should alias onto an authored sprite`);
    assert.match(spriteOrEmoji(id), /^<svg/, `${id} should render the sprite, not the fallback`);
  }
});

test('an item with no sprite degrades to its emoji rather than an empty box', () => {
  assert.equal(hasSprite('alloy'), false);
  const html = spriteOrEmoji('alloy', 3);
  assert.match(html, /^<span class="pspr pspr-emoji"/);
  assert.match(html, /aria-hidden="true"/, 'decorative fallback stays out of the a11y tree');
  assert.ok(html.includes(emojiFor('alloy')));
});

test('a registered sheet overrides the pixel map behind the same API', () => {
  registerSheet('data:image/png;base64,AAAA', 2, 1, 16, 16, ['ice', null]);
  const html = spriteHTML('ice', 2);
  assert.match(html, /^<span class="pspr sheet"/, 'the sheet cell wins over the pixel map');
  assert.match(html, /image-rendering:pixelated/);
});
