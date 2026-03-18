import { build } from 'esbuild';

// Packages that must NOT be bundled (provided by runtime or have native bindings)
const external = [
  'electron',
  'electron-log',
  'uuid',
  // Optional native WebSocket performance bindings (ws package)
  'bufferutil',
  'utf-8-validate',
  // node-pre-gyp and its optional dev-only deps
  '@mapbox/node-pre-gyp',
  'mock-aws-s3',
  'aws-sdk',
  'nock',
];

const baseConfig = {
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outdir: 'dist/main',
  external,
  loader: { '.html': 'empty' },
};

await Promise.all([
  build({ ...baseConfig, entryPoints: ['src/main/index.ts'] }),
  build({ ...baseConfig, entryPoints: ['src/main/preload.ts'] }),
]);

console.log('Main process build complete.');
