/**
 * 1) Hoist jest.mock (babel-plugin-jest-hoist) — required when not using babel-jest/ts-jest.
 * 2) Replace import.meta for Node CJS (globalThis.__IMPORT_META__ from setupTests).
 * 3) Compile TS/TSX with esbuild.
 */
const path = require('path');
const babel = require('@babel/core');
const esbuild = require('esbuild');

const sep = path.sep;
const inNodeModules = (p) => p.includes(`${sep}node_modules${sep}`);

module.exports = {
  process(sourceText, sourcePath) {
    const loader = sourcePath.endsWith('.tsx')
      ? 'tsx'
      : sourcePath.endsWith('.ts')
        ? 'ts'
        : 'js';

    let code = sourceText;

    if (!inNodeModules(sourcePath) && (sourcePath.endsWith('.ts') || sourcePath.endsWith('.tsx'))) {
      const isTsx = sourcePath.endsWith('.tsx');
      const babelResult = babel.transformSync(sourceText, {
        filename: sourcePath,
        configFile: false,
        babelrc: false,
        sourceMaps: true,
        parserOpts: {
          sourceType: 'module',
          plugins: [['typescript', { isTSX: isTsx }], ...(isTsx ? ['jsx'] : [])],
        },
        plugins: ['babel-plugin-jest-hoist'],
      });
      code = babelResult.code || sourceText;
    }

    if (!inNodeModules(sourcePath)) {
      code = code.replace(/\bimport\.meta\b/g, 'globalThis.__IMPORT_META__');
    }

    const result = esbuild.transformSync(code, {
      loader,
      format: 'cjs',
      target: 'es2020',
      sourcemap: true,
      sourcefile: sourcePath,
    });

    return { code: result.code, map: result.map };
  },
};
