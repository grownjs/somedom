import { isFunction, format } from '../lib/util';
import { mountElement, createElement } from '../lib/node';

import {
  patchDocument,
  patchWindow,
  dropDocument,
  dropWindow,
} from './doc';

export default function renderToString(vnode, cb = createElement) {
  patchDocument();
  patchWindow();

  const target = document.createElement('div');

  const vm = {
    async toString() {
      return format(this.target ? this.target.outerHTML : target.innerHTML);
    },
  };

  if (isFunction(vnode)) {
    Object.assign(vm, vnode(target, cb));
  } else {
    mountElement(target, vnode, cb);
  }

  dropDocument();
  dropWindow();

  return vm;
}
