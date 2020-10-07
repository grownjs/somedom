import {
  isFunction, isScalar, isArray, isNode, isEmpty, isUndef, isDiff,
  zipMap, append, replace, detach, clone,
} from './util';

import {
  assignProps, updateProps, fixProps, fixTree,
} from './attrs';

import { Fragment, SVG_NS } from './shared';

export function destroyElement(target, wait = cb => cb()) {
  return Promise.resolve().then(() => wait(() => target.remove()));
}

export function createElement(value, svg, cb) {
  if (isFunction(value)) return value(svg, cb);
  if (isScalar(value)) return document.createTextNode(value);
  if (isUndef(value)) throw new TypeError(`Empty or invalid node, given '${value}'`);

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

export function updateElement(target, prev, next, svg, cb, i = 0) {
  if (i === null) {
    const a = fixProps([...prev]);
    const b = fixProps([...next]);

    if (target instanceof Fragment) {
      zipMap(a, b, (x, y, z) => updateElement(target.childNodes[z], x, y, svg, cb, null));
      return;
    }

    if (updateProps(target, a[1], b[1], svg, cb)) {
      if (isFunction(target.onupdate)) target.onupdate(target);
      if (isFunction(target.update)) target.update();
    }

    zipMap(a[2], b[2], (x, y, z) => updateElement(target, x, y, svg, cb, z));
  } else if (isScalar(prev) && isScalar(next)) {
    if (isDiff(prev, next)) {
      target.childNodes[i].nodeValue = next;
    }
  } else if (!prev && next) append(target, createElement(next, svg, cb));
  else if (prev && !next) destroyElement(target.childNodes[i]);
  else if (prev[0] !== next[0]) {
    if (isNode(prev) && isNode(next)) replace(target, createElement(next, svg, cb), i);
    else zipMap(prev, next, (x, y, z) => updateElement(target, x, y, svg, cb, z));
  } else updateElement(target.childNodes[i], prev, next, svg, cb, null);
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
