import {
  mountElement as mount,
  updateElement as patch,
  createElement as render,
  destroyElement as unmount,
} from './lib/node';

import {
  createView as view,
  createThunk as thunk,
} from './lib/views';

import {
  onError,
  useRef,
  useMemo,
  useState,
  useEffect,
} from './lib/hooks';

import {
  invokeProps,
  applyStyles as styles,
  applyClasses as classes,
  applyAnimations as animation,
} from './lib/props';

import {
  apply, format, filter, isUndef, isScalar, isArray, toArray, isFunction, isPlain,
} from './lib/util';

import Fragment from './lib/fragment';

import { fixProps } from './lib/attrs';
import { addEvents } from './lib/events';

export const h = (tag = 'div', attrs = null, ...children) => {
  if (isScalar(attrs)) return fixProps([tag, null, attrs, children]);
  if (isArray(attrs)) return fixProps([tag, null, attrs]);
  return fixProps([tag, attrs || null, children]);
};

export const pre = (vnode, svg, cb = render) => {
  return cb(['pre', { class: 'highlight' }, format(cb(vnode, svg).outerHTML)], svg);
};

export const bind = (tag, ...hooks) => {
  const cbs = filter(hooks, isFunction);

  const mix = (...args) => {
    return cbs.reduce((prev, cb) => cb(...args) || prev, undefined);
  };

  const cb = (...args) => (args.length <= 2 ? tag(args[0], args[1], mix) : mix(...args));

  const $ = () => new Fragment();

  mix.tags = Object.assign({},
    ...filter(hooks, x => isArray(x) || isPlain(x))
      .reduce((memo, cur) => memo.concat(cur), []).filter(isPlain));

  cb.view = (Tag, name) => {
    function Factory(ref, props, children) {
      if (this instanceof Factory) {
        if (isUndef(children) && (isScalar(props) || isArray(props))) {
          children = toArray(props);
          props = ref;
          ref = null;
        }

        if (isUndef(props)) {
          props = ref;
          ref = null;
        }

        return view(Tag)(props, children)(ref, cb);
      }

      if (isUndef(children)) {
        return view(Tag)(ref, props)($(), cb).target;
      }

      return view(Tag)(props, children)(ref, cb);
    }

    Object.defineProperty(Factory, 'name', {
      value: name || Tag.name || 'View',
    });

    return Factory;
  };

  cb.tag = (Tag, name) => {
    const mount$ = cb.view(Tag, name);

    return (props, children) => {
      return mount$($(), props, children).target;
    };
  };

  return cb;
};

export const listeners = opts => apply(addEvents, 3, opts);
export const attributes = opts => apply(invokeProps, 3, opts);

export {
  mountElement as mount,
  updateElement as patch,
  createElement as render,
  destroyElement as unmount,
} from './lib/node';

export {
  createView as view,
  createThunk as thunk,
} from './lib/views';

export {
  onError,
  useRef,
  useMemo,
  useState,
  useEffect,
} from './lib/hooks';

export {
  applyStyles as styles,
  applyClasses as classes,
  applyAnimations as animation,
} from './lib/props';

export default {
  h,
  pre,
  bind,

  view,
  thunk,

  mount,
  patch,
  render,
  unmount,

  listeners,
  attributes,

  styles,
  classes,
  animation,

  onError,
  useRef,
  useMemo,
  useState,
  useEffect,
};
