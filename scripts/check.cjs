const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const files = ['geometry.js', 'app.js'];
for (const directory of ['scripts', 'tests']) {
  for (const name of fs.readdirSync(path.join(root, directory))) {
    if (name.endsWith('.cjs')) files.push(`${directory}/${name}`);
  }
}
for (const file of files) execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'inherit' });
console.log(`JavaScript syntax: ${files.length} files checked`);
