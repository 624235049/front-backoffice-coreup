// Regenerates src/routeTree.gen.ts without starting Vite (used by `typecheck`).
import { createRequire } from 'node:module';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
// @tanstack/router-generator is a dependency of the router plugin, not of this app: resolve it through the plugin.
const pluginRequire = createRequire(require.resolve('@tanstack/router-plugin/package.json'));
const { Generator, getConfig } = await import(pluginRequire.resolve('@tanstack/router-generator'));

const config = getConfig({ target: 'react', autoCodeSplitting: true }, root);
await new Generator({ config, root }).run();
