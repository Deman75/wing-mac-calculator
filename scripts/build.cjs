const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const assets = ['styles.css', 'geometry.js', 'app.js'];
const standaloneName = 'wing-mac-calculator.html';

function replaceOnce(source, marker, replacement) {
  if (!source.includes(marker) || source.indexOf(marker) !== source.lastIndexOf(marker)) {
    throw new Error(`Expected exactly one asset reference: ${marker}`);
  }
  // A function replacement preserves literal $ sequences in JavaScript and CSS.
  return source.replace(marker, () => replacement);
}

function build({ outDir = path.join(root, 'dist') } = {}) {
  outDir = path.resolve(outDir);
  if (outDir === path.resolve(root)) throw new Error('Build output must differ from the source directory');
  const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const contents = Object.fromEntries(assets.map(name => [name, fs.readFileSync(path.join(root, name), 'utf8')]));
  const site = replaceOnce(source, `href="./dist/${standaloneName}"`, `href="./${standaloneName}"`);
  let standalone = source.replace(/<!-- standalone-download:start -->[\s\S]*?<!-- standalone-download:end -->\s*/, '');
  standalone = replaceOnce(standalone, '<link rel="stylesheet" href="./styles.css"/>',
    `<style>\n${contents['styles.css'].replace(/<\/style/gi, '<\\/style')}\n</style>`);
  for (const name of ['geometry.js', 'app.js']) {
    standalone = replaceOnce(standalone, `<script src="./${name}" defer></script>`,
      `<script>\n${contents[name].replace(/<\/script/gi, '<\\/script')}\n</script>`);
  }
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), site);
  for (const name of assets) fs.writeFileSync(path.join(outDir, name), contents[name]);
  const standalonePath = path.join(outDir, standaloneName);
  fs.writeFileSync(standalonePath, standalone);
  fs.writeFileSync(path.join(outDir, '.nojekyll'), '');
  return { outDir, standalonePath };
}

if (require.main === module) {
  const result = build();
  console.log(`Website: ${path.relative(root, result.outDir)}/index.html`);
  console.log(`Offline HTML: ${path.relative(root, result.standalonePath)}`);
}

module.exports = { build, standaloneName };
