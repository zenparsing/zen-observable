import { babel } from '@rollup/plugin-babel';

function emitModulePackageFile() {
  return {
    name: 'emit-module-package-file',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'package.json',
        source: '{"type":"module"}',
      });
    },
  };
}

export default {
  input: ['src/index.js', 'src/extras.js'],
  output: [
    { dir: 'dist/cjs/', format: 'cjs', exports: 'named' },
    { dir: 'dist/es/', format: 'es', plugins: [emitModulePackageFile()] },
  ],
  plugins: [
    babel({
      babelHelpers: 'bundled',
      plugins: require('./scripts/babel-plugins'),
    }),
  ],
};
