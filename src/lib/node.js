import {
  isFunction, isScalar, isArray, isNode, isText, isEmpty, isUndef, isDiff,
  zipMap, append, replace, detach, clone, peek, raf,
} from './util';

import {
  assignProps, updateProps, fixProps, fixTree,
} from './attrs';

import { Fragment, SVG_NS, raise } from './shared';

export function destroyElement(target, wait = cb => cb()) {
  return Promise.resolve().then(() => wait(() => target.remove()));
}

export function createElement(value, svg, cb) {
  if (isFunction(value)) return value(svg, cb);
  if (isScalar(value)) return document.createTextNode(value);
  if (isUndef(value)) raise(value);

  if (!isNode(value)) {
    return isArray(value)
      ? new Fragment(value, node => createElement(node, svg, cb))
      : value;
  }

  const [tag, attrs, children] = fixProps([...value]);
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

  append(target, el);

  return el;
}

// FIXME: diff on scalars?
export function updateElement(target, prev, next, svg, cb, i = null) {
  if (i === null) {
    if (isArray(prev) && isArray(next)) {
      const a = fixProps(prev);
      const b = fixProps(next);

      if (isNode(a) && isNode(b)) {
        if (target.tagName.toLowerCase() === a[0]) {
          if (updateProps(target, a[1], b[1], svg, cb)) {
            if (isFunction(target.onupdate)) target.onupdate(target);
            if (isFunction(target.update)) target.update();
          }

          // FIXME: key lookup would start here?
          zipMap(a[2], b[2], (x, y, z) => updateElement(target, x, y, svg, cb, z));
        } else {
          detach(target.childNodes[0], createElement(b, svg, cb));
        }
      } else if (!isNode(a) && !isNode(b)) {
        zipMap(a, b, (x, y, z) => updateElement(target, x, y, svg, cb, z));
      } else {
        replace(target, createElement(b, svg, cb), 0);
      }
    }
  } else if (target.childNodes[i]) {
    if (next === null) {
      destroyElement(target.childNodes[i]);
    } else {
      replace(target, createElement(next, svg, cb), i);
    }
  } else {
    append(target, createElement(next, svg, cb));
  }
}

export function createView(tag, state, actions) {
  return (el, cb = createElement) => {
    const data = clone(state);
    const fns = [];

    let childNode;
    let vnode;

    const $ = Object.keys(actions)
      .reduce((prev, cur) => {
        prev[cur] = (...args) => Promise.resolve()
          .then(() => actions[cur](...args)(data))
          .then(result => Object.assign(data, result))
          .then(() => Promise.all(fns.map(fn => fn(data))))
          .then(() => updateElement(childNode, vnode, vnode = fixTree(tag(data, $)), null, cb, null)); // eslint-disable-line

        return prev;
      }, {});

    childNode = mountElement(el, vnode = fixTree(tag(data, $)), cb);

    $.subscribe = fn => Promise.resolve(fn(data)).then(() => fns.push(fn));
    $.unmount = () => destroyElement(childNode);
    $.target = childNode;

    return $;
  };
}
