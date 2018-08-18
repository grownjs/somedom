import {
  isFunction, isScalar, isArray, isNode, isEmpty, isUndef, isDiff, append, replace, detach, zipMap,
} from './util';

import { assignProps, updateProps, fixProps } from './attrs';

export const SVG_NS = 'http://www.w3.org/2000/svg';

export function destroyElement(target, wait = cb => cb()) {
  return Promise.resolve().then(() => wait(() => target.remove()));
}

export function createElement(value, svg, cb) {
  if (isScalar(value)) return document.createTextNode(value);
  if (isUndef(value)) throw new TypeError(`Empty or invalid node, given '${value}'`);
  if (!isNode(value)) return;

  const [tag, attrs, children] = fixProps([...value]);
  const isSvg = svg || tag === 'svg';

  let el;

  if (typeof tag === 'string') {
    el = isSvg ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);
  }

  if (isFunction(cb)) {
    el = cb(el, tag, attrs, children) || el;
  }

  if (isFunction(el)) return createElement(el(), isSvg, cb);

  if (!el && isFunction(tag)) {
    el = tag(attrs, children);

    if (isScalar(el) || isArray(el)) {
      el = createElement(el, svg, cb);
    }

    return el;
  }

  if (!isEmpty(attrs)) assignProps(el, attrs, isSvg, cb);
  if (isFunction(el.oncreate)) el.oncreate(el);
  if (isFunction(el.enter)) el.enter();

  el.remove = () => Promise.resolve()
    .then(() => isFunction(el.ondestroy) && el.ondestroy(el))
    .then(() => isFunction(el.teardown) && el.teardown())
    .then(() => isFunction(el.exit) && el.exit())
    .then(() => detach(el));

  children.map(vnode => !isEmpty(vnode) && el.appendChild(createElement(vnode, isSvg, cb)));

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

  const el = isScalar(view) || isNode(view) ? cb(view) : view;

  append(target, el);

  return el;
}

export function updateElement(target, prev, next, svg, cb, i = 0) {
  if (i === null) {
    const a = fixProps([...prev]);
    const b = fixProps([...next]);
    const c = updateProps(target, a[1], b[1], svg, cb);

    return Promise.resolve()
      .then(c && Promise.resolve()
        .then(() => isFunction(target.onupdate) && target.onupdate(target))
        .then(() => isFunction(target.update) && target.update()))
      .then(() => zipMap(a[2], b[2], (x, y, z) => updateElement(target, x, y, svg, cb, z)));
  }

  return Promise.resolve().then(() => {
    if (isScalar(prev) && isScalar(next)) {
      if (isDiff(prev, next)) {
        target.childNodes[i].nodeValue = next;
      }
    } else if (!prev && next) mountElement(target, next, cb);
    else if (prev && !next) return destroyElement(target.childNodes[i]);
    else if (prev[0] !== next[0]) replace(target, createElement(next, svg, cb), i);
    else return updateElement(target.childNodes[i], prev, next, svg, cb, null);
  });
}

export function createView(tag, state, actions) {
  return (el, cb = createElement) => {
    const data = { ...state };

    let childNode;
    let vnode;

    const $ = Object.keys(actions)
      .reduce((prev, cur) => {
        prev[cur] = (...args) => Promise.resolve()
          .then(() => actions[cur](...args)(data))
          .then(result => Object.assign(data, result))
          .then(newData => updateElement(childNode, vnode, vnode = tag(newData, $), null, cb, null)); // eslint-disable-line

        return prev;
      }, {});

    childNode = mountElement(el, vnode = tag(data, $), cb);

    $.unmount = () => destroyElement(childNode);
    $.target = childNode;

    return $;
  };
}
