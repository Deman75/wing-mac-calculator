const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { build, standaloneName } = require('../scripts/build.cjs');
const { app } = require('./helpers.cjs');

test('offline build contains all assets and runs the same calculations, SVG and input bindings', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wingmac-build-test-'));
  const result = build({ outDir });
  const site = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
  const standalone = fs.readFileSync(result.standalonePath, 'utf8');
  assert.ok(site.includes(`href="./${standaloneName}"`));
  assert.ok(!standalone.includes('standalone-download:'));
  assert.ok(!standalone.includes('class="download-html"'));
  assert.doesNotMatch(standalone, /<script\b[^>]*\bsrc\s*=|<link\b[^>]*rel="stylesheet"/i);
  assert.doesNotMatch(standalone, /(?:src|href)=["'](?:https?:)?\/\//i);
  const scripts = [...standalone.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1].trim());
  assert.equal(scripts.length, 2);
  const root = path.join(__dirname, '..');
  for (const [i, name] of ['geometry.js', 'app.js'].entries()) {
    const original = fs.readFileSync(path.join(root, name), 'utf8');
    assert.equal(scripts[i], original.trim());
    assert.equal(fs.readFileSync(path.join(outDir, name), 'utf8'), original);
  }
  assert.equal(fs.readFileSync(path.join(outDir, 'styles.css'), 'utf8'), fs.readFileSync(path.join(root, 'styles.css'), 'utf8'));
  const sourceApp = app();
  const offlineApp = app({ markup: standalone, scripts });
  for (const a of [sourceApp, offlineApp]) {
    a.inputs.innerSpan.value = '0';
    a.inputs.rootChord.value = '400';
    a.inputs.outerSpan.value = '600';
    a.inputs.tipChord.value = '200';
    a.inputs.outerSweep.value = '0';
    a.update();
    assert.equal(a.out.heroC.textContent, '311,11 мм');
    assert.equal(a.out.heroY.textContent, '266,67 мм');
    assert.equal(a.out.heroCG.textContent, '+77,78 мм');
    a.inputs.outerRootChord.value = '600'; a.inputs.outerRootChord.listeners.input();
    assert.equal(a.inputs.rootChord.value, '600');
    assert.equal(a.out.heroC.textContent, '433,33 мм');
  }
  assert.equal(JSON.stringify(sourceApp.svg), JSON.stringify(offlineApp.svg));
  const snapshot = fs.readFileSync(result.standalonePath, 'utf8');
  build({ outDir });
  assert.equal(fs.readFileSync(result.standalonePath, 'utf8'), snapshot, 'Build must be deterministic');
});

test('geometry can be used independently of the DOM', () => {
  const geometry = require('../geometry.js');
  const data = geometry.calc({ useInner: false, innerSpan: 'unused', rootChord: 300,
    jointChord: 'unused', innerSweep: 'unused', outerSpan: 1000, tipChord: 300,
    outerSweep: 0, cgPercent: 25 });
  assert.equal(data.ok, true);
  assert.equal(data.totalMac, 300);
  assert.equal(data.totalY, 500);
  assert.equal(data.cgX, 75);
});
