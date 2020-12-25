import {
  isFunction, isScalar, isArray, isNode, isEmpty, isUndef,
  offsetAt, sortedZip, append, replace, detach,
} from './util';

import {
  assignProps, updateProps, fixProps,
} from './attrs';

import { SVG_NS } from './shared';

import Fragment from './fragment';

export function destroyElement(target, wait = cb => cb()) {
  return Promise.resolve().then(() => wait(() => target.remove()));
}

export function createElement(value, svg, cb) {
  if (value instanceof Fragment) return value;
  if (isScalar(value)) return document.createTextNode(value);
  if (isUndef(value)) throw new Error(`Invalid vnode, given '${value}'`);

  if (!isNode(value)) {
    return isArray(value)
      ? Fragment.from(value, node => createElement(node, svg, cb))
      : value;
  }

  let fixedVNode = fixProps(value);

  if (isFunction(fixedVNode[0])) {
    const retval = fixedVNode[0](fixedVNode[1], fixedVNode.slice(2));

    if (!isNode(retval)) {
      return createElement(retval);
    }

    while (isFunction(retval[0])) {
      retval[0] = retval[0](fixedVNode[1], fixedVNode.slice(2));
    }

    if (!isNode(retval)) {
      return createElement(retval[0]);
    }

    fixedVNode = fixProps(retval);
  }

  const [tag, attrs, ...children] = fixedVNode;
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
  if (isFunction(view)) {
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

    if (!target) {
      throw new Error(`Target '${arguments[0]}' not found`);
    }
  }

  const el = isArray(view) || isScalar(view) ? cb(view) : view;

  if (!isUndef(el)) append(target, el);

  return el;
}

export function updateElement(target, prev, next, svg, cb, i = null) {
  if (i === null) {
    prev = fixProps(prev);
    next = fixProps(next);

    if (target instanceof Fragment) {
      sortedZip(prev, next, (x, y, z) => updateElement(target.parentNode, x, y, svg, cb, z, -1), target.offset);
    } else if (isArray(prev) && isArray(next)) {
      if (target.nodeType === 1) {
        if (isNode(prev) && isNode(next)) {
          if (target.tagName === next[0].toUpperCase()) {
            if (updateProps(target, prev[1] || {}, next[1] || {}, svg, cb)) {
              if (isFunction(target.onupdate)) target.onupdate(target);
              if (isFunction(target.update)) target.update();
            }

            if (target._anchored) {
              sortedZip(prev.slice(2), next.slice(2), (x, y, z) => updateElement(target, x, y, svg, cb, z), offsetAt(target, x => x._anchored));
            } else {
              sortedZip(prev.slice(2), next.slice(2), (x, y, z) => updateElement(target, x, y, svg, cb, z));
            }
          } else {
            detach(target, createElement(next, svg, cb));
          }
        } else if (isNode(prev)) {
          detach(target, createElement(next, svg, cb));
        } else if (target._anchored) {
          sortedZip(prev, next, (x, y, z) => updateElement(target, x, y, svg, cb, z), offsetAt(target, x => x._anchored));
        } else {
          sortedZip(prev, next, (x, y, z) => updateElement(target, x, y, svg, cb, z));
        }
      } else if (target.nodeType === 3) {
        sortedZip(prev, next, (x, y, z) => updateElement(target.parentNode, x, y, svg, cb, z), offsetAt(target.parentNode, x => x === target) - 1);
      } else {
        sortedZip(prev, next, (x, y, z) => updateElement(target, x, y, svg, cb, z));
      }
    } else if (target.nodeType !== 3) {
      detach(target, createElement(next, svg, cb));
    } else if (next instanceof Fragment) {
      target.nodeValue = next.outerHTML;
    } else {
      target.nodeValue = next;
    }
  } else if (target.childNodes[i]) {
    if (isUndef(next)) {
      if (target.childNodes[i].nodeType !== 3) {
        destroyElement(target.childNodes[i]);
      } else {
        detach(target.childNodes[i]);
      }
    } else if (!prev || prev[0] !== next[0]) {
      replace(target, createElement(next, svg, cb), i);
    } else {
      updateElement(target.childNodes[i], prev, next, svg, cb, null);
    }
  } else {
    append(target, createElement(next, svg, cb));
  }
}
