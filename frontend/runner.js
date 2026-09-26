const { spawn } = require('child_process');
const path = require('path');

// Keep parent Node process alive indefinitely regardless of stdin state
setInterval(() => {}, 1000 * 60 * 60);

const nextBin = path.join(__dirname, 'node_modules', 'next', 'dist', 'bin', 'next');

const child = spawn(process.execPath, [nextBin, 'dev'], {
  stdio: ['ignore', 'inherit', 'inherit'],
  windowsHide: true
});

child.on('exit', (code) => {
  console.log(`[runner.js] Next.js dev server exited with code ${code}`);
  process.exit(code || 0);
});
