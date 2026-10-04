// Reproducibly copy the pinned Three.js browser modules and retain their MIT license.
// npm ci verifies the package tarball against package-lock.json before this runs.
import { readFile, copyFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root = new URL('../', import.meta.url);
const source = new URL('../node_modules/three/', root);
const target = new URL('vendor/three/', root);
const pkg = JSON.parse(await readFile(new URL('package.json', source), 'utf8'));
assert.equal(pkg.version, '0.184.0', 'Review and pin version updates explicitly');
const files = [['build/three.core.min.js', 'three.core.min.js'], ['build/three.module.min.js', 'three.module.min.js'], ['LICENSE', 'LICENSE']];
const check = process.argv.includes('--check');
if (!check) await mkdir(target, { recursive: true });
for (const [from, to] of files) {
  const src = new URL(from, source), dst = new URL(to, target);
  if (check) assert.deepEqual(await readFile(dst), await readFile(src), `Vendored file drift: ${to}`);
  else await copyFile(src, dst);
  console.log(`${to} sha256:${createHash('sha256').update(await readFile(dst)).digest('hex')}`);
}
