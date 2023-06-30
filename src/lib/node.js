import {
  detach, freeze,
} from './util.js';

import {
  assignProps, updateProps,
} from './attrs.js';

import {
  toKeys, toProxy, toArray, toNodes, toFragment, isFunction, isScalar, isArray, isNode, isEmpty, isBlock, isDiff, isNot,
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

  vnode = toArray(vnode, freeze);

  if (!isNode(vnode)) {
    if (isArray(vnode)) {
      return Fragment.from(v => createElement(v, svg, cb), vnode);
    }
    return (isScalar(vnode) && document.createTextNode(String(vnode))) || vnode;
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

  if (isBlock(view)) {
    view.forEach(node => {
      mountElement(target, node, svg, cb);
    });
  } else if (!isNot(view)) {
    target = insertElement(target, view, svg, cb);
  }
  return target;
}

export async function upgradeNode(target, prev, next, svg, cb) {
  if (isScalar(next)) {
    return replaceElement(target, next, svg, cb);
  }

  if (!isNode(prev) || prev[0] !== next[0] || target.nodeType !== 1) {
    return replaceElement(target, next, svg, cb);
  }

  if (!isArray(next[1])) {
    next[1] = toProxy(next[1]);
  }

  if (updateProps(target, prev[1] || [], next[1] || [], svg, cb)) {
    if (isFunction(target.onupdate)) await target.onupdate(target);
    if (isFunction(target.update)) await target.update();
  }

  return next[1] && toKeys(next[1]).includes('@html') ? target : updateElement(target, toFragment(prev), toFragment(next), svg, cb);
}

export async function upgradeElements(target, vnode, svg, cb) {
  const tasks = [];
  const next = toArray(vnode, freeze);
  const c = Math.max(target.childNodes.length, next.length);

  let off = 0;
  let old;
  let el;
  let x;
  for (let i = 0; i < c; i += 1) {
    if (old !== off) {
      el = target.childNodes[off];
      x = toNodes(el);
      old = off;
    }

    const y = next.shift();

    if (isNot(y)) {
      tasks.push({ rm: el });
      old = null;
    } else if (isNot(x)) {
      tasks.push({ add: y });
      off++;
    } else {
      tasks.push({ patch: x, with: y, target: el });
      off++;
    }
  }

  if (off !== target.childNodes.length) {
    for (let k = target.childNodes.length; k > off; k--) {
      tasks.push({ rm: target.childNodes[k] });
    }
  }

  for (const task of tasks) {
    if (task.rm) await destroyElement(task.rm);
    if (!isNot(task.add)) insertElement(target, task.add, svg, cb);
    if (!isNot(task.patch)) await patchNode(task.target, task.patch, task.with, svg, cb);
  }
}

export async function updateElement(target, prev, next, svg, cb) {
  if (!prev || (isNode(prev) && isNode(next))) {
    return upgradeNode(target, prev, next, svg, cb);
  }

  if (isNode(prev)) {
    while (isArray(next) && next.length === 1) next = next[0];
    return updateElement(target, [prev], next, svg, cb);
  }

  if (isNode(next)) {
    return upgradeNode(target, prev, next, svg, cb);
  }

  await upgradeElements(target, [next], svg, cb);
  return target;
}

export async function patchNode(target, prev, next, svg, cb) {
  if (Fragment.valid(next)) {
    let anchor = target;
    while (next.childNodes.length > 0) {
      const node = next.childNodes.pop();

      target.parentNode.insertBefore(node, anchor);
      anchor = node;
    }

    detach(target);
    return anchor;
  }

  if (target.nodeType === 3 && isScalar(next)) {
    if (isDiff(prev, next)) {
      target.nodeValue = String(next);
    }
  } else {
    target = await upgradeNode(target, prev, next, svg, cb);
  }
  return target;
}
