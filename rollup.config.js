import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import { terser } from 'rollup-plugin-terser';

const pkg = require('./package.json');

const isDev = process.env.ROLLUP_WATCH || process.env.NODE_ENV === 'test';
const isProd = process.env.NODE_ENV === 'production';

function bundle(file, format, customName) {
  return {
    sourcemap: false,
    name: customName || pkg.name,
    format,
    file,
  };
}

const plugins = [
  resolve(),
  commonjs(),
  isProd && terser(),
];

export default isDev ? {
  input: 'tests/e2e/main.test.js',
  output: bundle('./docs/tests.js', 'iife'),
  plugins,
} : [{
  input: './src/index.js',
  output: [
    bundle(pkg.main, 'cjs'),
    bundle(pkg.module, 'es'),
    bundle(pkg.browser, 'umd'),
  ],
  plugins,
}, {
  input: './src/ssr/index.js',
  output: bundle('./dist/index.ssr.js', 'cjs'),
}];
