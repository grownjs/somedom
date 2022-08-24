import { isFunction, format } from '../lib/util';
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

export default { useWindow, renderToString };
