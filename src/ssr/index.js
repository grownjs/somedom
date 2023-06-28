import { selectAll, selectOne } from 'css-select';

import { isFunction, format } from '../lib/util.js';
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
export { bindHelpers } from './doc.js';

export * from '../index.js';

/* global globalThis */

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

    globalThis.document = window.document;
    globalThis.window = window;
    globalThis.Event = window.Event;
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
    delete globalThis.document;
    delete globalThis.window;
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
