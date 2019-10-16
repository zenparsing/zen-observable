import babel from 'rollup-plugin-babel';

export default {
  input: [
    'index.js',
    'extras.js',
  ],
  output: [
    {
      dir: 'lib',
      format: 'esm',
    },
    {
      dir: 'lib/cjs',
      format: 'cjs',
    },
  ],
  plugins: [
    babel({
      plugins: require('./scripts/babel-plugins'),
    }),
  ],
};
