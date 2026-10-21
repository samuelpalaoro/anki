import { cpSync, existsSync, mkdirSync } from 'fs';

// Copy sw.js and manifest into dist if not already there
if (existsSync('sw.js')) {
  cpSync('sw.js', 'dist/sw.js');
}
if (existsSync('manifest.webmanifest')) {
  cpSync('manifest.webmanifest', 'dist/manifest.webmanifest');
}

// Ensure icons are copied into dist/assets/icons
if (existsSync('assets/icons')) {
  mkdirSync('dist/assets/icons', { recursive: true });
  cpSync('assets/icons', 'dist/assets/icons', { recursive: true });
}
