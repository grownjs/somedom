import {
  createElement as render,
} from './lib/node.js';

import {
  invokeProps,
} from './lib/props.js';

import {
  apply, format, filter, isNot, isScalar, isArray, isFunction, isPlain,
} from './lib/util.js';

import { addEvents } from './lib/events.js';

export const h = (tag = 'div', attrs = null, ...children) => {
  if (isScalar(attrs)) return [tag, null, [attrs].concat(children).filter(x => !isNot(x))];
  if (isArray(attrs) && !children.length) return [tag, null, attrs];
  return [tag, attrs || null, children];
};

export const pre = (vnode, svg, cb = render) => {
  return cb(['pre', ['class', 'highlight'], format(cb(vnode, svg).outerHTML)], svg);
};

export const bind = (tag, ...hooks) => {
  const cbs = filter(hooks, isFunction);

  const mix = (...args) => {
    return cbs.reduce((prev, cb) => cb(...args) || prev, undefined);
  };

  const cb = (...args) => (args.length <= 2 ? tag(args[0], args[1], mix) : mix(...args));

  cb.tags = mix.tags = Object.assign({},
    ...filter(hooks, x => isArray(x) || isPlain(x))
      .reduce((memo, cur) => memo.concat(cur), []).filter(isPlain));

  return cb;
};

export const listeners = opts => apply(addEvents, 3, opts);
export const attributes = opts => apply(invokeProps, 3, opts);

export {
  raf, tick, format,
} from './lib/util.js';

export {
  toProxy as proxy,
} from './lib/shared.js';

export {
  mountElement as mount,
  updateElement as patch,
  createElement as render,
  destroyElement as unmount,
} from './lib/node.js';

export {
  applyStyles as styles,
  applyClasses as classes,
  applyAnimations as animation,
} from './lib/props.js';
