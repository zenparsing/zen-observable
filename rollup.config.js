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
};
