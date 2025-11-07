const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();
const binDir = path.join(projectRoot, 'node_modules', '.bin');
const target = path.join(projectRoot, 'packages', 'patch-package', 'bin', 'patch-package.js');

try {
  fs.mkdirSync(binDir, { recursive: true });
} catch (error) {
  // ignore mkdir errors; installation will likely fail later if we cannot create the directory
}

const posixShimPath = path.join(binDir, 'patch-package');
const posixShim = `#!/usr/bin/env node\nrequire(${JSON.stringify(target)});\n`;

const cmdShimPath = path.join(binDir, 'patch-package.cmd');
const relativeTargetForCmd = path.relative(binDir, target).replace(/\\/g, '\\\\');
const cmdShim = `@echo off\r\nnode "%~dp0${relativeTargetForCmd}" %*\r\n`;

try {
  fs.writeFileSync(posixShimPath, posixShim, { mode: 0o755 });
  fs.chmodSync(posixShimPath, 0o755);
  console.log('[ensure-patch-package-bin] Created patch-package shim at', posixShimPath);
} catch (error) {
  console.warn('[ensure-patch-package-bin] Failed to create POSIX shim:', error);
}

try {
  fs.writeFileSync(cmdShimPath, cmdShim);
  console.log('[ensure-patch-package-bin] Created patch-package shim at', cmdShimPath);
} catch (error) {
  console.warn('[ensure-patch-package-bin] Failed to create Windows shim:', error);
}
