import { isFunction, format } from '../lib/util';
import { mountElement, createElement } from '../lib/node';

import {
  patchDocument,
  patchWindow,
  dropDocument,
  dropWindow,
} from './doc';

export { bindHelpers } from './doc';

export function renderToString(vnode, cb = createElement) {
  patchDocument();
  patchWindow();

  const target = document.createElement('div');

  async function render() {
    return format(render.target ? render.target.outerHTML : target.innerHTML);
  }

  if (isFunction(vnode)) {
    Object.assign(render, vnode(target, cb));
  } else {
    mountElement(target, vnode, cb);
  }

  dropDocument();
  dropWindow();

  return render;
}
