import { selectAll, selectOne } from 'css-select';

import { format } from '../lib/util.js';
import { isFunction } from '../lib/shared.js';
import { parse, parseDefaults } from './himalaya/index.js';
import { mountElement, createElement } from '../lib/node.js';

import {
  patchDocument,
  patchWindow,
  dropDocument,
  dropWindow,
} from './doc.js';

import { markupAdapter } from './adapter.js';

export { markupAdapter } from './adapter.js';
export { bindHelpers, encodeText, decodeEnts } from './doc.js';

export * from '../index.js';

/* global globalThis */
const _global = typeof global === 'undefined' ? globalThis : global;

let patched;
let builtin;
export function enable(env) {
  if (patched) return;
  builtin = false;
  if (env && (env.jsdom || env.happydom)) {
    let window;
    if (env.happydom) {
      const { Window } = env.happydom;
      window = new Window();
    } else {
      const { JSDOM } = env.jsdom;
      ({ window } = new JSDOM());
    }

    _global.document = window.document;
    _global.window = window;
    if (typeof Deno === 'undefined' && typeof Bun === 'undefined') _global.Event = window.Event;
  } else {
    patchDocument();
    patchWindow();
    builtin = true;
  }
  patched = true;
}

export function disable() {
  if (!patched) return;
  if (!builtin) {
    delete _global.document;
    delete _global.window;
  } else {
    dropDocument();
    dropWindow();
  }
  patched = null;
}

export function useWindow(cb) {
  try {
    enable();
    return cb();
  } finally {
    disable();
  }
}

export function findOne(rule, children, adapter = markupAdapter) {
  return selectOne(rule, children, { adapter });
}

export function findAll(rule, children, adapter = markupAdapter) {
  return selectAll(rule, children, { adapter });
}

export function parseMarkup(html, options) {
  return parse(html, { ...parseDefaults, ...options });
}

export function astToVnode(ast) {
  if (!ast) return null;
  if (Array.isArray(ast)) {
    return ast.map(astToVnode).filter(x => x != null);
  }
  if (ast.type === 'text') {
    return ast.content;
  }
  if (ast.type === 'element') {
    const attrs = {};
    for (const { key, value } of ast.attributes) {
      attrs[key] = value;
    }
    const children = ast.children ? ast.children.map(astToVnode).filter(x => x != null) : [];
    return [ast.tagName, attrs, ...children];
  }
  return null;
}

export function renderToString(vnode, cb = createElement) {
  return useWindow(() => {
    const target = document.createElement('div');

    async function render() {
      return format(render.target ? render.target.outerHTML : target.innerHTML);
    }

    if (isFunction(vnode)) {
      Object.assign(render, vnode(target, cb));
    } else {
      mountElement(target, vnode, cb);
    }

    return render;
  });
}
