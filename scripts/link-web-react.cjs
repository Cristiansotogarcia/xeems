const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const repoRoot = path.resolve(__dirname, '..');
const webRoot = path.join(repoRoot, 'apps', 'web');
const webNodeModules = path.join(webRoot, 'node_modules');
const webReactPath = path.join(webNodeModules, 'react');

function log(message) {
  process.stdout.write(`[link-web-react] ${message}\n`);
}

if (!fs.existsSync(webNodeModules)) {
  log('Skipping because apps/web/node_modules does not exist yet.');
  process.exit(0);
}

const webRequire = createRequire(path.join(webRoot, 'package.json'));

let reactDomEntry;
try {
  reactDomEntry = webRequire.resolve('react-dom');
} catch (error) {
  log(`Skipping because react-dom could not be resolved: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(0);
}

const targetReactEntry = webRequire.resolve('react', { paths: [path.dirname(reactDomEntry)] });
const targetReactDir = path.dirname(targetReactEntry);

if (path.resolve(webReactPath) === path.resolve(targetReactDir)) {
  log('apps/web already points at the shared React runtime.');
  process.exit(0);
}

try {
  fs.rmSync(webReactPath, { recursive: true, force: true });
  fs.symlinkSync(targetReactDir, webReactPath, 'junction');
  log(`Linked apps/web/node_modules/react -> ${targetReactDir}`);
} catch (error) {
  log(`Unable to normalize React for apps/web: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
