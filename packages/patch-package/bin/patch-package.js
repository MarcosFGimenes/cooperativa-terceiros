#!/usr/bin/env node

/**
 * Minimal patch-package replacement used to satisfy environments that expect
 * the `patch-package` binary during `npm install`.
 *
 * The script attempts to apply any .patch files found inside the `patches`
 * directory relative to the project root. If no patches are present the script
 * exits successfully without making any changes.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = process.cwd();
const patchesDir = path.join(projectRoot, 'patches');

if (!fs.existsSync(patchesDir)) {
  console.log('[patch-package shim] No `patches` directory found. Skipping.');
  process.exit(0);
}

const patchFiles = fs
  .readdirSync(patchesDir)
  .filter((file) => file.endsWith('.patch'))
  .sort();

if (patchFiles.length === 0) {
  console.log('[patch-package shim] No patch files found. Skipping.');
  process.exit(0);
}

let hasErrors = false;

for (const patchFile of patchFiles) {
  const patchPath = path.join(patchesDir, patchFile);
  console.log(`[patch-package shim] Applying ${patchFile}`);

  const result = spawnSync('patch', ['-p1', '-N', '-i', patchPath], {
    cwd: projectRoot,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    hasErrors = true;
    console.error(`[patch-package shim] Failed to apply ${patchFile}`);
  }
}

process.exit(hasErrors ? 1 : 0);
