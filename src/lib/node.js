import {
  isFunction, isScalar, isArray, isNode, isEmpty, isBlock, isDiff, isNot, append, detach, zip,
} from './util';

import {
  assignProps, updateProps,
} from './attrs';

import Fragment from './fragment';
import { SVG_NS } from './shared';

export function destroyElement(target, wait = cb => cb()) {
  const rm = () => target && target.remove();

  return wait === false ? rm() : Promise.resolve().then(() => wait(rm));
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
    vnode = vnode[0](vnode[1], vnode.slice(2));
  }

  if (!isArray(vnode)) {
    if (Fragment.valid(vnode)) return vnode;
    if (vnode.target) return vnode.target;
    return vnode;
  }

  if (cb && cb.tags && cb.tags[vnode[0]]) {
    return createElement(cb.tags[vnode[0]](vnode[1], vnode.slice(2), cb), svg, cb);
  }

  if (!isNode(vnode)) {
    return Fragment.from(v => createElement(v, svg, cb), vnode);
  }

  const isSvg = svg || vnode[0].indexOf('svg') === 0;
  const [tag, props, ...children] = vnode;

  let el = isSvg
    ? document.createElementNS(SVG_NS, tag)
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
    const newNode = createElement(view, svg, cb);

    append(target, newNode);
    return newNode;
  }
  return target;
}

export async function upgradeNode(target, prev, next, svg, cb) {
  if (!isNode(prev) || prev[0] !== next[0] || target.nodeType !== 1) {
    const newNode = createElement(next, svg, cb);

    if (Fragment.valid(newNode)) {
      detach(target, newNode);
    } else {
      target.replaceWith(newNode);
    }
    return newNode;
  }

  if (updateProps(target, prev[1] || {}, next[1] || {}, svg, cb)) {
    if (isFunction(target.onupdate)) await target.onupdate(target);
    if (isFunction(target.update)) await target.update();
  }

  if (next[1] && next[1]['@html']) {
    target.innerHTML = next[1]['@html'];
    return target;
  }

  return updateElement(target, prev.slice(2), next.slice(2), svg, cb);
}

export async function upgradeElement(target, next, svg, cb) {
  if (isFunction(next[0])) {
    const newNode = createElement(next, svg, cb);

    if (Fragment.valid(newNode)) {
      detach(target, newNode);
    } else {
      target.replaceWith(newNode);
      return newNode;
    }
    return target;
  }
}

export async function upgradeElements(target, prev, next, svg, cb, i) {
  const stack = [];
  const set = target.childNodes;
  const push = v => stack.push(v);

  if (!isBlock(next)) next = [next];

  zip(set, prev, next, i || 0, push);

  const keep = stack.filter(x => x.patch);

  for (const task of stack) {
    if (task.rm && !keep.find(x => x.target === task.rm)) {
      await destroyElement(task.rm);
    }
    if (!isNot(task.patch)) {
      await patchNode(task.target, task.patch, task.with, svg, cb);
    }
    if (!isNot(task.add)) {
      const newNode = createElement(task.add, svg, cb);

      if (Fragment.valid(newNode)) {
        newNode.mount(target);
      } else {
        target.appendChild(newNode);
      }
    }
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
  await upgradeElement(target, next, svg, cb);

  if (isDiff(prev, next)) {
    if (target.nodeType === 3) {
      if (isNode(next)) {
        target = await upgradeNode(target, prev, next, svg, cb);
      } else {
        const rm = [];
        for (let k = next.length - prev.length; k > 0; k--) rm.push(destroyElement(target.nextSibling || null));
        await Promise.all(rm);

        if (isBlock(prev) && isBlock(next)) {
          detach(target, createElement(next, svg, cb));
        } else {
          target.nodeValue = String(next);
        }
      }
    } else {
      target = await upgradeNode(target, prev, next, svg, cb);
    }
  }
  return target;
}
