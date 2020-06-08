require('@babel/register')({
  plugins: [
    ...require('./babel-plugins'),
    '@babel/plugin-transform-modules-commonjs',
  ],
});
