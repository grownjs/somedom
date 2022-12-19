import { isFunction, format } from '../lib/util';
import { parse, parseDefaults } from './himalaya';
import { mountElement, createElement } from '../lib/node';

import {
  patchDocument,
  patchWindow,
  dropDocument,
  dropWindow,
} from './doc';

export {
  bindHelpers,
} from './doc';

export * from '../index';

export function useWindow(cb) {
  try {
    patchDocument();
    patchWindow();

    return cb();
  } finally {
    dropDocument();
    dropWindow();
  }
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
