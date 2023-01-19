import { selectAll, selectOne } from 'css-select';

import { isFunction, format } from '../lib/util';
import { parse, parseDefaults } from './himalaya';
import { mountElement, createElement } from '../lib/node';

import {
  patchDocument,
  patchWindow,
  dropDocument,
  dropWindow,
} from './doc';

import { markupAdapter } from './adapter';

export { markupAdapter } from './adapter';
export { bindHelpers } from './doc';

export * from '../index';

const isNode = !(typeof Deno !== 'undefined' || typeof Bun !== 'undefined');

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

    global.document = window.document;
    global.window = window;

    if (isNode) {
      global.Event = window.Event;
    }
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
    delete global.document;
    delete global.window;

    if (isNode) {
      delete global.Event;
    }
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
