import {
  isFunction, isScalar, isArray, isNode, isEmpty, isBlock, isDiff, isNot, detach, zip,
} from './util.js';

import {
  assignProps, updateProps,
} from './attrs.js';

import {
  toKeys, toProxy, toFragment,
} from './shared.js';

import Fragment from './fragment.js';

export function destroyElement(target, wait = cb => cb()) {
  const rm = () => target && target.remove();

  return wait === false ? rm() : Promise.resolve().then(() => wait(rm));
}

export function replaceElement(target, next, svg, cb) {
  const newNode = createElement(next, svg, cb);

  if (Fragment.valid(newNode)) {
    detach(target, newNode);
  } else {
    target.replaceWith(newNode);
  }
  return newNode;
}

export function insertElement(target, next, svg, cb) {
  const newNode = createElement(next, svg, cb);

  if (Fragment.valid(newNode)) {
    newNode.mount(target);
  } else {
    target.appendChild(newNode);
  }
  return newNode;
}

export function createElement(vnode, svg, cb) {
  if (isNot(vnode)) throw new Error(`Invalid vnode, given '${vnode}'`);
  if (!isNode(vnode)) {
    if (isArray(vnode)) {
      return Fragment.from(v => createElement(v, svg, cb), vnode);
    }
    return (isScalar(vnode) && document.createTextNode(String(vnode))) || vnode;
  }

  while (vnode && isFunction(vnode[0])) {
    vnode = vnode[0](toProxy(vnode[1]), toFragment(vnode));
  }

  if (!isArray(vnode)) {
    return vnode;
  }

  if (cb && cb.tags && cb.tags[vnode[0]]) {
    return createElement(cb.tags[vnode[0]](toProxy(vnode[1]), toFragment(vnode), cb), svg, cb);
  }

  if (!isNode(vnode)) {
    return Fragment.from(v => createElement(v, svg, cb), vnode);
  }

  const isSvg = svg || vnode[0].indexOf('svg') === 0;
  const [tag, props, ...children] = vnode;

  let el = isSvg
    ? document.createElementNS('http://www.w3.org/2000/svg', tag)
    : document.createElement(tag);

  if (isFunction(cb)) {
    el = cb(el, tag, props, children) || el;
  }

  if (isFunction(el)) return createElement(el(), isSvg, cb);
  if (!isEmpty(props)) assignProps(el, props, isSvg, cb);
  if (isFunction(el.oncreate)) el.oncreate(el);
  if (isFunction(el.enter)) el.enter();

  el.remove = () => Promise.resolve()
    .then(() => isFunction(el.ondestroy) && el.ondestroy(el))
    .then(() => isFunction(el.teardown) && el.teardown())
    .then(() => isFunction(el.exit) && el.exit())
    .then(() => detach(el));

  children.forEach(sub => {
    mountElement(el, sub, isSvg, cb);
  });
  return el;
}

export function mountElement(target, view, svg, cb) {
  if (isFunction(view)) {
    cb = view;
    view = target;
    target = undefined;
  }

  if (isFunction(svg)) {
    cb = svg;
    svg = null;
  }

  if (isNot(view)) {
    view = target;
    target = undefined;
  }

  if (!target) {
    target = document.body;
  }

  if (typeof target === 'string') {
    target = document.querySelector(target);
  }

  if (isArray(view) && !isNode(view)) {
    view.forEach(node => {
      mountElement(target, node, svg, cb);
    });
  } else if (!isNot(view)) {
    target = insertElement(target, view, svg, cb);
  }
  return target;
}

export async function upgradeNode(target, prev, next, svg, cb) {
  if (!isNode(prev) || prev[0] !== next[0] || target.nodeType !== 1) {
    return replaceElement(target, next, svg, cb);
  }

  if (updateProps(target, prev[1] || [], next[1] || [], svg, cb)) {
    if (isFunction(target.onupdate)) await target.onupdate(target);
    if (isFunction(target.update)) await target.update();
  }

  return next[1] && toKeys(next[1]).includes('@html') ? target : updateElement(target, toFragment(prev), toFragment(next), svg, cb);
}

export async function upgradeElements(target, prev, next, svg, cb, i) {
  const stack = [];
  const set = target.childNodes;
  const push = v => stack.push(v);

  if (!isBlock(next)) next = [next];

  zip(set, prev, next, i || 0, push);

  for (const task of stack) {
    if (task.rm) await destroyElement(task.rm);
    if (!isNot(task.add)) insertElement(target, task.add, svg, cb);
    if (!isNot(task.patch)) await patchNode(task.target, task.patch, task.with, svg, cb);
  }
}

export async function updateElement(target, prev, next, svg, cb, i) {
  if (!prev || (isNode(prev) && isNode(next))) {
    return upgradeNode(target, prev, next, svg, cb);
  }

  if (isNode(prev)) {
    if (next.length === 1) next = next[0];
    return updateElement(target, [prev], next, svg, cb);
  }

  if (isNode(next)) {
    return upgradeNode(target, prev, next, svg, cb);
  }

  await upgradeElements(target, prev, next, svg, cb, i);
  return target;
}

export async function patchNode(target, prev, next, svg, cb) {
  if (isFunction(next[0]) || (target.nodeType === 1 && target.tagName.toLowerCase() !== next[0])) {
    return replaceElement(target, next, svg, cb);
  }

  if (isDiff(prev, next)) {
    if (target.nodeType === 3) {
      if (isNode(next)) {
        target = await upgradeNode(target, prev, next, svg, cb);
      } else {
        target.nodeValue = String(next);
      }
    } else {
      target = await upgradeNode(target, prev, next, svg, cb);
    }
  }
  return target;
}
