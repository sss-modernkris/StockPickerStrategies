process.stdin.resume();
const { spawn } = require('child_process');
const path = require('path');

const nextBin = path.join(__dirname, 'node_modules', 'next', 'dist', 'bin', 'next');

const next = spawn(process.execPath, [nextBin, 'dev'], {
  stdio: 'inherit'
});

next.on('close', (code) => {
  process.exit(code || 0);
});
