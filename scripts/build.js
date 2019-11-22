const { execSync } = require('child_process');

execSync('babel src --out-dir lib --config-file=./scripts/babel-plugins.js', {
  env: process.env,
  stdio: 'inherit',
});
