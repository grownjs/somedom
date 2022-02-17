import {
  isFunction, isScalar, isArray, isNode, isEmpty, isDiff, isNot,
  toArray, append, detach, tree, zip,
} from './util';

import {
  assignProps, updateProps, fixProps,
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

  vnode = tree(vnode);
  while (vnode && isFunction(vnode[0])) {
    vnode = vnode[0](vnode[1], vnode[2]);
    vnode = tree(vnode);
  }

  if (!isArray(vnode)) {
    if (vnode instanceof Fragment) return vnode;
    if (vnode.target) return vnode.target;
    return vnode;
  }

  if (cb && cb.tags && cb.tags[vnode[0]]) {
    return createElement(cb.tags[vnode[0]](vnode[1], vnode[2], cb), svg, cb);
  }

  if (!isNode(vnode)) {
    return Fragment.from(v => createElement(v, svg, cb), vnode);
  }

  const isSvg = svg || vnode[0].indexOf('svg') === 0;
  const [tag, props, children] = fixProps(vnode);

  let el = isSvg
    ? document.createElementNS(SVG_NS, tag)
    : document.createElement(tag);

  if (isFunction(cb)) {
    el = cb(el, tag, props, children) || el;
  }

  if (isFunction(el)) return createElement(el(), isSvg, cb);
  if (el.nodeType === 1) {
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
  }
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

export async function updateElement(target, prev, next, svg, cb, i) {
  if (target.__dirty) {
    return target.__update ? target.__update(target, prev, next, svg, cb, i) : target;
  }
  if (target instanceof Fragment) {
    await updateElement(target.root, target.vnode, target.vnode = next, svg, cb, target.offset); // eslint-disable-line;
    if (isFunction(target.onupdate)) await target.onupdate(target);
    if (isFunction(target.update)) await target.update();
    destroyElement(target.anchor, false);
    return target;
  }
  if (isArray(prev) && isArray(next)) {
    if (isNode(prev) && isNode(next)) {
      return patchNode(target, prev, next, svg, cb);
    } if (!isNode(prev)) {
      if (isNode(next) || target.nodeType === 3) {
        const newNode = createElement(next, svg, cb);

        target.replaceWith(newNode);
        return newNode;
      }
      await zipNodes(prev, next, target, svg, cb, i);
    } else {
      await zipNodes([prev], next, target.parentNode || target, svg, cb, i);
    }
  } else {
    await zipNodes(toArray(prev), toArray(next), target, svg, cb, i);
  }
  return target;
}

export async function patchNode(target, prev, next, svg, cb) {
  if (prev[0] !== next[0] || isFunction(next[0])) {
    const newNode = createElement(next, svg, cb);

    if (newNode instanceof Fragment) {
      newNode.mount(target.parentNode, target);
      if (isFunction(newNode.onupdate)) await newNode.onupdate(newNode);
      if (isFunction(newNode.update)) await newNode.update();

      const rm = [];

      let leaf = target;
      let c = target._anchored.length;
      while (leaf && c > 0) {
        c -= 1;
        rm.push(leaf);
        leaf = leaf.nextSibling;
      }
      rm.forEach(x => destroyElement(x, false));
    } else {
      if (target._anchored) await target._anchored.remove();
      target.replaceWith(newNode);
    }
    return newNode;
  }
  if (target.nodeType === 1) {
    if (updateProps(target, prev[1] || {}, next[1] || {}, svg, cb)) {
      if (isFunction(target.onupdate)) await target.onupdate(target);
      if (isFunction(target.update)) await target.update();
    }
    if (prev[2] || next[2]) {
      return updateElement(target, !isNode(prev[2]) ? toArray(prev[2]) : [prev[2]], toArray(next[2]), svg, cb);
    }
  } else {
    return patchNode(target, [], next, svg, cb);
  }
  return target;
}

export function zipNodes(a, b, el, svg, cb, off = 0) {
  let j = off;
  return zip(a, b, async (x, y, z) => {
    let target = el.childNodes[z + j];
    if (isNot(y)) {
      if (!target) {
        while (!el.childNodes[z + j] && (z + j) > 0) j -= 1;
        target = el.childNodes[z + j];
      }
    }

    while (target && target.__dirty) {
      target = el.childNodes[z + ++j]; // eslint-disable-line
    }

    if (target) {
      if (isNot(x)) {
        mountElement(el, y, svg, cb);
      } else if (isNot(y)) {
        await destroyElement(target._anchored || target);
      } else if (isNode(x) && isNode(y)) {
        await patchNode(target, x, y, svg, cb);
        if (target._anchored) j += target._anchored.length;
      } else if (isDiff(x, y)) {
        if (target.nodeType === 3 && !isNode(y) && (!isArray(y) || !y.some(isNode))) {
          target.nodeValue = isArray(y) ? y.join('') : y.toString();
        } else {
          detach(target, createElement(y, svg, cb));
        }
      }
    } else {
      mountElement(el, y, svg, cb);
    }
  });
}
