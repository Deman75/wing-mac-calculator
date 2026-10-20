// Development checks only. Sharing index.html does not require this file or Node.js.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];

// A small DOM stub runs the application's actual calculations and SVG builders.
// It does not check browser layout; that requires a separate browser run.
class Element {
  constructor(name = 'div') {
    this.name = name;
    this.attrs = {};
    this.children = [];
    this.value = '';
    this.checked = false;
    this.disabled = false;
    this.textContent = '';
    this.listeners = {};
  }
  setAttribute(key, value) { this.attrs[key] = String(value); }
  set value(value) { this.inputValue = String(value); }
  get value() { return this.inputValue; }
  appendChild(node) {
    this.children = this.children.filter(child => child !== node);
    this.children.push(node);
    return node;
  }
  addEventListener(event, handler) { this.listeners[event] = handler; }
  set innerHTML(value) { this.children = []; this.html = value; }
  get innerHTML() { return this.html; }
}

function app() {
  const nodes = {};
  const document = {
    getElementById: id => nodes[id] ??= new Element(),
    createElementNS: (_, name) => new Element(name)
  };
  for (const match of html.matchAll(/<input\b[^>]*id="([^"]+)"[^>]*>/g)) {
    const input = document.getElementById(match[1]);
    input.value = match[0].match(/value="([^"]*)"/)?.[1] ?? '';
    input.checked = /\bchecked(?:=|\s|\/?>)/.test(match[0]);
  }
  const context = vm.createContext({ document });
  vm.runInContext(source.replace(/\}\)\(\);\s*$/, 'globalThis.api = {calc, update, inputs, out, svg, assembly};})();'), context);
  return { ...context.api, elements: nodes };
}

const base = { innerSpan: 0, rootChord: 300, jointChord: 150, innerSweep: 0,
  outerSpan: 1000, tipChord: 300, outerSweep: 0, cgPercent: 25 };
function set(a, values = {}) {
  for (const [key, value] of Object.entries({ ...base, ...values })) a.inputs[key].value = String(value);
  a.inputs.useInner.checked = Number(a.inputs.innerSpan.value) !== 0;
  a.update();
  return a.calc();
}
function near(actual, expected, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}
const flatten = node => [node, ...node.children.flatMap(flatten)];
const outline = a => flatten(a.svg).find(node => node.attrs.class === 'wing-outline');
const svgSnapshot = a => JSON.stringify(a.svg, (key, value) => key === 'listeners' ? undefined : value);

test('CHECKS A–D, zero outer span and triangular tips', () => {
  const a = app();
  const scenarios = [
    [{}, { totalMac: 300, totalY: 500, totalXLE: 0, area: 600000, fullSpan: 2000, aspectRatio: 20 / 3, cgX: 75 }],
    [{ rootChord: 400, jointChord: 200, outerSpan: 600, tipChord: 200 }, { totalMac: 2800 / 9, totalY: 800 / 3, totalXLE: 0, cgX: 700 / 9 }],
    [{ innerSpan: 400, rootChord: 400, jointChord: 200, outerSpan: 600, tipChord: 100, outerSweep: 25 }, { totalMac: 244.444444444, totalY: 387.301587302, totalXLE: 53.292303789, cgX: 114.403414900 }],
    [{ innerSpan: 400, rootChord: 250, jointChord: 250, outerSpan: 600, tipChord: 250 }, { totalMac: 250, totalY: 500, totalXLE: 0 }],
    [{ innerSpan: 600, rootChord: 400, jointChord: 200, outerSpan: 0, innerSweep: -20 }, { totalMac: 2800 / 9, totalY: 800 / 3, totalXLE: 800 / 3 * Math.tan(-Math.PI / 9) }],
    [{ rootChord: 300, outerSpan: 900, tipChord: 0 }, { totalMac: 200, totalY: 300 }],
    [{ innerSpan: 900, rootChord: 300, jointChord: 0, outerSpan: 0 }, { totalMac: 200, totalY: 300 }]
  ];
  for (const [values, expected] of scenarios) {
    const data = set(a, values);
    assert.equal(data.ok, true, data.message);
    for (const [key, value] of Object.entries(expected)) near(data[key], value);
    if (!data.hasInner) {
      near(data.totalMac, data.outer.mac);
      near(data.totalY, data.outer.yMac);
      near(data.totalXLE, data.outer.xMacLE);
    }
  }
});

test('independent integration: different sweep signs and 0/25/50/100% CG', () => {
  const a = app();
  for (const [sw1, sw2] of [[-25, 17], [15, -35], [0, 0], [30, 30]]) {
    for (const cg of [0, 25, 50, 100]) {
      const data = set(a, { innerSpan: 400, rootChord: 400, jointChord: 200, outerSpan: 600, tipChord: 100, innerSweep: sw1, outerSweep: sw2, cgPercent: cg });
      let area = 0, c2 = 0, momentY = 0, momentX = 0;
      // Simpson's rule integrates c, c², y*c and xLE*c independently.
      for (const [start, span, c0, c1, x0, angle] of [[0, 400, 400, 200, 0, sw1], [400, 600, 200, 100, 400 * Math.tan(sw1 * Math.PI / 180), sw2]]) {
        const n = 100, h = span / n;
        for (let i = 0; i <= n; i++) {
          const y = i * h, c = c0 + (c1 - c0) * y / span;
          const x = x0 + y * Math.tan(angle * Math.PI / 180);
          const weight = (i === 0 || i === n ? 1 : i % 2 ? 4 : 2) * h / 3;
          area += weight * c; c2 += weight * c * c;
          momentY += weight * (start + y) * c; momentX += weight * x * c;
        }
      }
      near(data.totalMac, c2 / area); near(data.totalY, momentY / area);
      near(data.totalXLE, momentX / area); near(data.cgX, momentX / area + c2 / area * cg / 100);
    }
  }
});

test('unused fields never affect calculation or SVG, including invalid values', () => {
  const a = app();
  set(a); const single = svgSnapshot(a);
  for (const value of ['', -100, 0, 'bad', 1e200]) {
    assert.equal(set(a, { jointChord: value, innerSweep: value }).ok, true);
    assert.equal(svgSnapshot(a), single);
  }
  const inner = { innerSpan: 600, rootChord: 400, jointChord: 200, outerSpan: 0 };
  set(a, inner); const innerOnly = svgSnapshot(a);
  for (const value of ['', -100, 0, 'bad', 1e200]) {
    assert.equal(set(a, { ...inner, tipChord: value, outerSweep: value }).ok, true);
    assert.equal(svgSnapshot(a), innerOnly);
  }
  assert.equal(outline(a).attrs.points.split(' ').length, 4);
});

test('invalid input clears every result and removes geometry', () => {
  const a = app();
  for (const values of [{ rootChord: '' }, { outerSpan: '' }, { cgPercent: '' },
    { rootChord: -1 }, { outerSpan: -1 }, { innerSpan: -1 }, { outerSpan: 0 },
    { outerSweep: 90 }, { outerSweep: -90 }, { outerSweep: 180 },
    { cgPercent: 201 }, { rootChord: 1e200 },
    { innerSpan: 400, jointChord: '' }, { innerSpan: 400, jointChord: 0 }]) {
    set(a); assert.equal(set(a, values).ok, false, JSON.stringify(values));
    for (const [key, node] of Object.entries(a.out)) {
      if (!['macText', 'macDetails', 'status'].includes(key)) assert.equal(node.textContent, '—', key);
    }
    assert.equal(outline(a), undefined);
    assert.equal(a.assembly.children.length, 0);
    assert.equal(set(a).ok, true);
  }
});

test('switch and manual zero span agree; positive span is restored', () => {
  const a = app();
  set(a, { innerSpan: 420, jointChord: 200 });
  a.inputs.useInner.checked = false; a.inputs.useInner.listeners.input();
  assert.equal(a.inputs.innerSpan.value, '0');
  assert.equal(a.inputs.jointChord.disabled, true);
  assert.equal(a.inputs.innerSweep.disabled, true);
  assert.equal(a.inputs.rootChord.disabled, true);
  const switched = a.calc();
  const zero = set(a, { jointChord: 200 });
  near(switched.totalMac, zero.totalMac); near(switched.totalY, zero.totalY);
  a.inputs.useInner.checked = true; a.inputs.useInner.listeners.input();
  assert.equal(Number(a.inputs.innerSpan.value), 420);
  assert.equal(a.inputs.jointChord.disabled, false);
  assert.equal(a.calc().hasInner, true);
  a.inputs.innerSpan.value = '0'; a.inputs.innerSpan.listeners.input();
  assert.equal(a.inputs.useInner.checked, false);
  assert.equal(a.calc().hasInner, false);
  near(a.calc().totalMac, zero.totalMac);
});

test('outer root chord follows the joint or edits the whole-wing root; panels follow the switch', () => {
  const a = app();
  set(a, { innerSpan: 420, rootChord: 400, jointChord: 250, outerSpan: 600, tipChord: 200 });
  assert.equal(a.inputs.outerRootChord.readOnly, true);
  assert.equal(a.inputs.outerRootChord.value, '250');
  a.inputs.jointChord.value = '280'; a.inputs.jointChord.listeners.input();
  assert.equal(a.inputs.outerRootChord.value, '280');
  a.inputs.outerRootChord.value = '999'; a.inputs.outerRootChord.listeners.input();
  assert.equal(a.inputs.jointChord.value, '280');
  assert.equal(a.inputs.outerRootChord.value, '280');

  a.inputs.useInner.checked = false; a.inputs.useInner.listeners.input();
  assert.equal(a.elements.innerSection.open, false);
  assert.equal(a.elements.outerSection.open, true);
  assert.equal(a.inputs.outerRootChord.readOnly, false);
  assert.equal(a.inputs.outerRootChord.value, '400');
  const previous = svgSnapshot(a);
  a.inputs.outerRootChord.value = '600'; a.inputs.outerRootChord.listeners.input();
  assert.equal(a.inputs.rootChord.value, '600');
  near(a.calc().totalMac, 1300 / 3); near(a.calc().totalY, 250);
  near(a.calc().cgX, 325 / 3);
  assert.notEqual(svgSnapshot(a), previous);
  a.inputs.outerRootChord.value = ''; a.inputs.outerRootChord.listeners.input();
  assert.equal(a.calc().ok, false);
  assert.equal(a.out.heroC.textContent, '—');
  a.inputs.outerRootChord.value = '600'; a.inputs.outerRootChord.listeners.input();

  a.inputs.useInner.checked = true; a.inputs.useInner.listeners.input();
  assert.equal(a.elements.innerSection.open, true);
  assert.equal(a.inputs.outerRootChord.readOnly, true);
  assert.equal(a.inputs.outerRootChord.value, '280');
  assert.equal(a.inputs.rootChord.value, '600');
  assert.equal(a.inputs.innerSpan.value, '420');
  a.inputs.innerSpan.value = '0'; a.inputs.innerSpan.listeners.input();
  assert.equal(a.elements.innerSection.open, false);
  assert.equal(a.inputs.outerRootChord.value, '600');
  assert.equal(a.inputs.outerRootChord.readOnly, false);
});

test('SVG uses calculated positions and one scale; axes start at root LE', () => {
  const a = app();
  for (const values of [{}, { innerSpan: 400, rootChord: 400, jointChord: 200, outerSpan: 600, tipChord: 100, innerSweep: 15, outerSweep: -35 }, { innerSpan: 600, outerSpan: 0 }]) {
    const data = set(a, values);
    const points = outline(a).attrs.points.split(' ').map(point => point.split(',').map(Number));
    const [x, y] = points[0], scale = (points.at(-1)[0] - x) / data.cRoot;
    const tip = points[data.hasInner && data.hasOuter ? 2 : 1];
    near(tip[1] - y, scale * data.halfSpan); near(tip[0] - x, scale * data.outer.xLE1);
    const nodes = flatten(a.svg), mac = nodes.find(node => node.attrs.class === 'mac-total');
    near(+mac.attrs.x1, x + scale * data.totalXLE); near(+mac.attrs.y1, y + scale * data.totalY);
    near(+mac.attrs.x2 - Number(mac.attrs.x1), scale * data.totalMac);
    const cg = nodes.find(node => node.name === 'circle' && node.attrs.fill === '#dc2626');
    near(+cg.attrs.cx, x + scale * data.cgX);
    const origin = nodes.find(node => node.attrs.id === 'coord-axes').children.find(node => node.name === 'circle');
    near(+origin.attrs.cx, x); near(+origin.attrs.cy, y);
  }
  a.inputs.showConstruction.checked = false; a.inputs.showConstruction.listeners.input();
  assert.equal(flatten(a.svg).some(node => node.attrs.class === 'construction'), false);
  assert.equal(a.assembly.children.length, 0);
  assert.ok(flatten(a.svg).some(node => node.attrs.class === 'mac-total'));
});
