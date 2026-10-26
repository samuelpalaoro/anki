/**
 * postbuild.js — Runs after `vite build`
 *
 * 1. Copies sw.js to dist/ with __CACHE_VERSION__ injected (hash of dist assets)
 * 2. Copies manifest.webmanifest to dist/
 * 3. Copies assets/icons/ to dist/assets/icons/
 */

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { createHash } from 'crypto';
import { join } from 'path';

// --- Compute a stable cache version from the built asset hashes ---
function computeCacheVersion() {
  const assetsDir = 'dist/assets';
  if (!existsSync(assetsDir)) return `build-${Date.now()}`;

  const hash = createHash('sha1');
  const files = readdirSync(assetsDir).sort(); // deterministic order
  for (const f of files) {
    hash.update(f); // filenames already contain Vite content hash
  }
  return hash.digest('hex').slice(0, 12);
}

const cacheVersion = computeCacheVersion();
console.log(`[postbuild] Cache version: ${cacheVersion}`);

// --- Copy and patch sw.js ---
if (existsSync('sw.js')) {
  let swSource = readFileSync('sw.js', 'utf8');
  // Replace the __CACHE_VERSION__ placeholder with the real version
  swSource = swSource.replace(
    "typeof __CACHE_VERSION__ !== 'undefined'\n  ? __CACHE_VERSION__\n  : 'dev-' + Date.now()",
    `'${cacheVersion}'`
  );
  writeFileSync('dist/sw.js', swSource, 'utf8');
  console.log('[postbuild] sw.js copied and patched.');
}

// --- Copy manifest ---
const manifestSrc = existsSync('public/manifest.webmanifest')
  ? 'public/manifest.webmanifest'
  : (existsSync('manifest.webmanifest') ? 'manifest.webmanifest' : null);

if (manifestSrc) {
  cpSync(manifestSrc, 'dist/manifest.webmanifest');
  console.log(`[postbuild] manifest.webmanifest copied from ${manifestSrc}.`);
}

// --- Copy icons ---
const iconsSrc = existsSync('public/assets/icons')
  ? 'public/assets/icons'
  : (existsSync('assets/icons') ? 'assets/icons' : null);

if (iconsSrc) {
  mkdirSync('dist/assets/icons', { recursive: true });
  cpSync(iconsSrc, 'dist/assets/icons', { recursive: true });
  console.log(`[postbuild] assets/icons/ copied from ${iconsSrc}.`);
}

