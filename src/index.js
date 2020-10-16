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
  apply, format, filter, isPlain, isFunction,
} from './lib/util';

import { addEvents } from './lib/events';

export const h = (name, attrs, ...children) => {
  return attrs === null || isPlain(attrs)
    ? [name, attrs || undefined, children]
    : [name, undefined, [attrs].concat(children)];
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

  cb.view = (Tag, name) => {
    function Factory(ref, props, children) {
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
      const $ = document.createDocumentFragment();

      mount$($, props, children);
      return $;
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
