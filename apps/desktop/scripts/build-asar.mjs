/**
 * Builds app.asar with all production dependencies properly resolved.
 * Works around pnpm symlink issues with electron-builder.
 */
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const STAGING = path.join(ROOT, 'release', 'asar-staging');
const ASAR_OUT = path.join(ROOT, 'release', 'win-unpacked', 'resources', 'app.asar');

const require = createRequire(path.join(ROOT, 'package.json'));

// Production deps to include
const PROD_DEPS = [
  '@supabase/supabase-js',
  '@supabase/functions-js',
  'electron-log',
  'electron-store',
  'uuid',
  'tslib',
];

const copied = new Set();

function resolvePackagePath(name, fromDir) {
  // First try the standard package.json export
  try {
    const pkgJsonPath = require.resolve(`${name}/package.json`, { paths: [fromDir] });
    return path.dirname(pkgJsonPath);
  } catch {}
  // Fallback: resolve the package main entry, then walk up to find package root
  try {
    const mainPath = require.resolve(name, { paths: [fromDir] });
    let dir = path.dirname(mainPath);
    while (dir !== path.dirname(dir)) {
      if (fs.existsSync(path.join(dir, 'package.json'))) {
        const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
        if (pkg.name === name || pkg.name === name.split('/').pop()) return dir;
      }
      dir = path.dirname(dir);
    }
  } catch {}
  return null;
}

function copyPackage(name, fromDir, destNodeModules) {
  const pkgPath = resolvePackagePath(name, fromDir);
  if (!pkgPath) return;

  const key = pkgPath;
  if (copied.has(key)) return;
  copied.add(key);

  const dest = path.join(destNodeModules, ...name.split('/'));
  if (fs.existsSync(dest)) return;

  // Get the scope dir if scoped package
  const scopeDir = name.startsWith('@') ? path.join(destNodeModules, name.split('/')[0]) : null;
  if (scopeDir && !fs.existsSync(scopeDir)) {
    fs.mkdirSync(scopeDir, { recursive: true });
  }

  console.log(`  Copying ${name} from ${pkgPath}`);
  fs.cpSync(pkgPath, dest, { recursive: true, dereference: true });

  // Recursively copy this package's deps
  const pkgJson = JSON.parse(fs.readFileSync(path.join(pkgPath, 'package.json'), 'utf8'));
  for (const dep of Object.keys(pkgJson.dependencies || {})) {
    copyPackage(dep, pkgPath, destNodeModules);
  }
}

// Clean staging
if (fs.existsSync(STAGING)) fs.rmSync(STAGING, { recursive: true });
fs.mkdirSync(STAGING, { recursive: true });

// Copy built files
console.log('Copying dist/...');
fs.cpSync(path.join(ROOT, 'dist'), path.join(STAGING, 'dist'), { recursive: true });

// Stripped package.json (only what's needed at runtime)
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const stripped = { name: pkg.name, version: pkg.version, main: pkg.main };
fs.writeFileSync(path.join(STAGING, 'package.json'), JSON.stringify(stripped, null, 2));

// Copy all production deps with full transitive dependency trees
const stagingNodeModules = path.join(STAGING, 'node_modules');
fs.mkdirSync(stagingNodeModules, { recursive: true });

console.log('Resolving and copying production dependencies...');
for (const dep of PROD_DEPS) {
  copyPackage(dep, ROOT, stagingNodeModules);
}

// Pack into ASAR
console.log('\nPacking ASAR...');
execSync(`npx asar pack "${STAGING}" "${ASAR_OUT}"`, { stdio: 'inherit', cwd: ROOT });

// Cleanup staging
fs.rmSync(STAGING, { recursive: true });

console.log('\nDone! ASAR written to:', ASAR_OUT);
