import { resolve } from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { buildManifest } from './src/manifest';
import pkg from './package.json' with { type: 'json' };

/** Emits manifest.json into the build. */
function manifest(env: Record<string, string>): Plugin {
  return {
    name: 'kortex-manifest',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.json',
        source: JSON.stringify(buildManifest(env, pkg.version), null, 2),
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  return {
    root: resolve(__dirname, 'src'),
    publicDir: resolve(__dirname, 'public'),
    envDir: __dirname,
    base: '',
    plugins: [preact(), manifest(env)],
    build: {
      outDir: resolve(__dirname, 'dist'),
      emptyOutDir: true,
      target: 'chrome127',
      modulePreload: false,
      sourcemap: mode === 'development',
      minify: mode !== 'development',
      rollupOptions: {
        input: {
          popup: resolve(__dirname, 'src/popup/index.html'),
          offscreen: resolve(__dirname, 'src/offscreen/index.html'),
          background: resolve(__dirname, 'src/background/index.ts'),
        },
        output: {
          entryFileNames: (chunk) => (chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js'),
        },
      },
    },
    test: {
      root: __dirname,
      include: ['src/**/*.test.ts'],
    },
  };
});
