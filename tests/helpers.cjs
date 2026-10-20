// Development checks only. The generated standalone HTML needs no Node.js.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const geometrySource = fs.readFileSync(path.join(__dirname, '..', 'geometry.js'), 'utf8');

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

function app({ markup = html, scripts = [geometrySource, source] } = {}) {
  const nodes = {};
  const document = {
    getElementById: id => nodes[id] ??= new Element(),
    createElementNS: (_, name) => new Element(name)
  };
  for (const match of markup.matchAll(/<input\b[^>]*id="([^"]+)"[^>]*>/g)) {
    const input = document.getElementById(match[1]);
    input.value = match[0].match(/value="([^"]*)"/)?.[1] ?? '';
    input.checked = /\bchecked(?:=|\s|\/?>)/.test(match[0]);
  }
  const context = vm.createContext({ document });
  for (const script of scripts.slice(0, -1)) vm.runInContext(script, context);
  vm.runInContext(scripts.at(-1).replace(/\}\)\(\);\s*$/, 'globalThis.api = {calc, update, inputs, out, svg, assembly};})();'), context);
  return { ...context.api, elements: nodes };
}


module.exports = { app };
