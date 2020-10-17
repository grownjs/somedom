import {
  isFunction, isScalar, isArray, isNode, isEmpty, isUndef,
  sortedZip, append, replace, detach,
} from './util';

import {
  assignProps, updateProps, fixProps, fixTree,
} from './attrs';

import { SVG_NS } from './shared';

import Fragment from './fragment';

export function destroyElement(target, wait = cb => cb()) {
  return Promise.resolve().then(() => wait(() => target.remove()));
}

export function createElement(value, svg, cb) {
  if (isScalar(value)) return document.createTextNode(value);
  if (isUndef(value)) throw new Error(`Invalid vnode, given '${value}'`);

  if (!isNode(value)) {
    return isArray(value)
      ? new Fragment(fixTree(value), node => createElement(node, svg, cb))
      : value;
  }

  let fixedVNode = fixProps(value);

  if (isFunction(fixedVNode[0])) {
    const retval = fixedVNode[0](fixedVNode[1], fixedVNode[2]);

    if (!isArray(retval) || !isNode(retval)) return retval;

    while (isFunction(retval[0])) {
      retval[0] = retval[0](fixedVNode[1], fixedVNode[2]);
    }

    if (!isNode(retval)) {
      return createElement(retval[0]);
    }

    fixedVNode = fixProps(retval);
  }

  const [tag, attrs, children] = fixedVNode;
  const isSvg = svg || tag === 'svg';

  let el = isSvg
    ? document.createElementNS(SVG_NS, tag)
    : document.createElement(tag);

  if (isFunction(cb)) {
    el = cb(el, tag, attrs, children) || el;
  }

  if (isFunction(el)) return createElement(el(), isSvg, cb);
  if (!isEmpty(attrs)) assignProps(el, attrs, isSvg, cb);
  if (isFunction(el.oncreate)) el.oncreate(el);
  if (isFunction(el.enter)) el.enter();

  el.remove = () => Promise.resolve()
    .then(() => isFunction(el.ondestroy) && el.ondestroy(el))
    .then(() => isFunction(el.teardown) && el.teardown())
    .then(() => isFunction(el.exit) && el.exit())
    .then(() => detach(el));

  children.forEach(vnode => {
    if (!isEmpty(vnode)) append(el, createElement(vnode, isSvg, cb));
  });

  return el;
}

export function mountElement(target, view, cb = createElement) {
  if (typeof view === 'function') {
    cb = view;
    view = target;
    target = undefined;
  }

  if (!view) {
    view = target;
    target = undefined;
  }

  if (!target) {
    target = document.body;
  }

  if (typeof target === 'string') {
    target = document.querySelector(target);
  }

  const el = isArray(view) || isScalar(view) ? cb(view) : view;

  if (!isUndef(el)) append(target, el);

  return el;
}

export function updateElement(target, prev, next, svg, cb, i = null) {
  if (i === null) {
    if (isArray(prev) && isArray(next)) {
      const a = fixProps(prev);
      const b = fixProps(next);

      if (target.nodeType === 1) {
        if (isNode(a) && isNode(b)) {
          if (target.tagName === b[0].toUpperCase()) {
            if (updateProps(target, a[1], b[1], svg, cb)) {
              if (isFunction(target.onupdate)) target.onupdate(target);
              if (isFunction(target.update)) target.update();
            }
            sortedZip(a[2], b[2], (x, y, z) => updateElement(target, x, y, svg, cb, z));
          } else {
            detach(target, createElement(b, svg, cb));
          }
        } else if (isNode(a)) {
          detach(target, createElement(b, svg, cb));
        } else {
          sortedZip(a, b, (x, y, z) => updateElement(target, x, y, svg, cb, z));
        }
      } else {
        sortedZip(a, b, (x, y, z) => updateElement(target, x, y, svg, cb, z));
      }
    } else if (target.nodeType !== 3) {
      detach(target, createElement(next, svg, cb));
    } else {
      target.nodeValue = next;
    }
  } else if (target.childNodes[i]) {
    if (isUndef(next)) {
      destroyElement(target.childNodes[i]);
    } else if (!prev || prev[0] !== next[0]) {
      replace(target, createElement(next, svg, cb), i);
    } else {
      updateElement(target.childNodes[i], prev, next, svg, cb, null);
    }
  } else {
    append(target, createElement(next, svg, cb));
  }
}
