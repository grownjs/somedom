import {
  detach,
} from './util.js';

import {
  assignProps, updateProps,
} from './attrs.js';

import {
  toArray, toNodes, toFragment, isFunction, isScalar, isArray, isNode, isEmpty, isBlock, isDiff, isNot,
  getKey, getKeyFromNode, isSignal,
} from './shared.js';

import Fragment from './fragment.js';
import Portal from './portal.js';

import { effect, computed } from './signals.js';

function createFunctionTextNode(fn, svg, cb) {
  const computedSignal = computed(fn);
  return createSignalNode(computedSignal, svg, cb);
}

function setupSignalNode(signal, svg, cb, current, currentVnode, skipInitial) {
  const update = async () => {
    const next = signal.peek();
    const dispose = current._signalDispose;

    if (isNot(next) || next === false) {
      if (current.nodeType === 3) { current.nodeValue = ''; }
      else {
        const t = document.createTextNode('');
        t._signalDispose = dispose;
        current.replaceWith(t);
        current = t;
      }
      currentVnode = null;
    } else if (isScalar(next)) {
      if (current.nodeType === 3) { current.nodeValue = String(next); }
      else {
        const t = document.createTextNode(String(next));
        t._signalDispose = dispose;
        current.replaceWith(t);
        current = t;
      }
      currentVnode = null;
    } else if (current.nodeType === 3) {
      const el = createElement(next, svg, cb);
      el._signalDispose = dispose;
      current.replaceWith(el);
      current = el;
      currentVnode = next;
    } else {
      current = await upgradeNode(current, currentVnode, next, svg, cb);
      current._signalDispose = dispose;
      currentVnode = next;
    }
  };

  if (!skipInitial) {
    Promise.resolve().then(update);
  }

  const dispose = effect(() => { signal.value; });

  if (!dispose._deps?.size && typeof signal.subscribe === 'function') {
    const unsub = signal.subscribe(() => update());
    current._signalDispose = () => { dispose(); unsub(); };
  } else {
    let initialized = skipInitial;
    const disposeUpdate = effect(() => {
      signal.value;
      if (initialized) update();
      initialized = true;
    });
    current._signalDispose = disposeUpdate;
  }

  return current;
}

function createSignalNode(signal, svg, cb) {
  return setupSignalNode(signal, svg, cb, document.createTextNode(''), null, false);
}

function hydrateSignalNode(signal, existingEl, existingVnode, svg, cb) {
  return setupSignalNode(signal, svg, cb, existingEl, existingVnode, true);
}

function createSignalTextNode(signal, svg, cb) {
  return createSignalNode(signal, svg, cb);
}

export const canMove = () => typeof Element !== 'undefined' && 'moveBefore' in Element.prototype;

export function destroyElement(target, wait = cb => cb()) {
  const rm = () => target && target.remove();

  return wait === false ? rm() : Promise.resolve().then(() => wait(rm));
}

export function replaceElement(target, next, svg, cb) {
  if (isFunction(target.onreplace)) return target.onreplace(next, svg, cb);

  const newNode = createElement(next, svg, cb);

  if (Portal.valid(newNode)) {
    newNode.mount();
    target.remove();
  } else if (Fragment.valid(newNode)) {
    detach(target, newNode);
  } else {
    target.replaceWith(newNode);
  }
  return newNode;
}

export function insertElement(target, next, svg, cb) {
  const newNode = createElement(next, svg, cb);

  if (Portal.valid(newNode)) {
    newNode.mount();
  } else if (Fragment.valid(newNode)) {
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
    if (isSignal(vnode)) {
      return createSignalTextNode(vnode, svg, cb);
    }
    if (isFunction(vnode)) {
      return createFunctionTextNode(vnode, svg, cb);
    }
    return (isScalar(vnode) && document.createTextNode(String(vnode))) || vnode;
  }

  if (!isArray(vnode)) {
    return vnode;
  }

  if (cb && cb.tags && cb.tags[vnode[0]]) {
    return createElement(cb.tags[vnode[0]](vnode[1], toFragment(vnode), cb), svg, cb);
  }

  if (!isNode(vnode)) {
    return Fragment.from(v => createElement(v, svg, cb), vnode);
  }

  if (isFunction(vnode[0])) {
    return createElement(vnode[0](vnode[1], vnode.slice(2)), svg, cb);
  }

  if (vnode[0] === 'portal') {
    const [, props, ...children] = vnode;
    return Portal.from(v => createElement(v, svg, cb), children, props.target);
  }

  const isSvg = svg || vnode[0].indexOf('svg') === 0;
  const [tag, props, ...children] = vnode;

  let el = isSvg
    ? document.createElementNS('http://www.w3.org/2000/svg', tag)
    : document.createElement(tag);

  if (props && props.key) {
    el.setAttribute('data-key', props.key);
  }

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

  const childNodes = el.childNodes;
  if (childNodes.length > 0) {
    const originalTeardown = el.teardown;
    el.teardown = () => {
      for (let i = 0; i < childNodes.length; i++) {
        const child = childNodes[i];
        if (child._signalDispose) {
          child._signalDispose();
        }
      }
      if (originalTeardown) originalTeardown();
    };
  }

  return el;
}

export function hydrateElement(target, view, svg, cb) {
  if (isFunction(view) && typeof svg === 'undefined' && typeof cb === 'undefined') {
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

  const vnodes = isBlock(view) ? view : [view];
  const domChildren = Array.from(target.childNodes);
  let domIdx = 0;

  for (let i = 0; i < vnodes.length; i++) {
    const vnode = vnodes[i];
    if (isNot(vnode) || vnode === false) continue;

    if (isSignal(vnode)) {
      const domEl = domChildren[domIdx];
      if (domEl) {
        hydrateSignalNode(vnode, domEl, domEl.nodeType === 3 ? domEl.nodeValue : toNodes(domEl, true), svg, cb);
        domIdx++;
      } else {
        const node = createSignalTextNode(vnode, svg, cb);
        target.appendChild(node);
      }
      continue;
    }

    if (isNode(vnode)) {
      const domEl = domChildren[domIdx];

      if (cb && cb.tags && cb.tags[vnode[0]]) {
        const tagResult = cb.tags[vnode[0]](vnode[1], toFragment(vnode), cb);

        if (isSignal(tagResult)) {
          const openMarker = findHydrateOpen(domChildren, domIdx);

          if (openMarker) {
            const closeIdx = findHydrateClose(domChildren, domChildren.indexOf(openMarker) + 1);
            const closeMarker = closeIdx !== -1 ? domChildren[closeIdx] : null;

            if (closeMarker) {
              const claimed = collectBetween(openMarker, closeMarker);
              openMarker.remove();
              closeMarker.remove();

              const peeked = tagResult.peek();
              if (isNot(peeked) || peeked === false) {
                const anchor = document.createTextNode('');
                target.insertBefore(anchor, claimed.length ? claimed[0] : null);
                claimed.forEach(n => n.remove());
                hydrateSignalNode(tagResult, anchor, null, svg, cb);
              } else if (claimed.length === 1) {
                hydrateSignalNode(tagResult, claimed[0], toNodes(claimed[0], true), svg, cb);
              } else if (claimed.length > 1) {
                const wrapper = document.createElement('slot');
                target.insertBefore(wrapper, claimed[0]);
                claimed.forEach(n => wrapper.appendChild(n));
                hydrateSignalNode(tagResult, wrapper, ['slot', {}, claimed.map(n => toNodes(n, true))], svg, cb);
              } else {
                const anchor = document.createTextNode('');
                target.appendChild(anchor);
                hydrateSignalNode(tagResult, anchor, null, svg, cb);
              }
              domIdx = closeIdx + 1;
            } else {
              if (domEl) domEl.remove();
              mountElement(target, tagResult, svg, cb);
            }
          } else {
            if (domEl) domEl.remove();
            mountElement(target, tagResult, svg, cb);
          }
        } else {
          if (domEl) domEl.remove();
          mountElement(target, tagResult, svg, cb);
        }
        continue;
      }

      if (domEl && domEl.nodeType === 1 && domEl.tagName.toLowerCase() === vnode[0]) {
        if (!isEmpty(vnode[1])) assignProps(domEl, vnode[1], svg, cb);
        hydrateElement(domEl, vnode.slice(2), svg, cb);
        domIdx++;
      } else {
        if (domEl) domEl.remove();
        mountElement(target, vnode, svg, cb);
      }
      continue;
    }

    if (isScalar(vnode)) {
      const domEl = domChildren[domIdx];
      if (domEl && domEl.nodeType === 3) {
        if (isDiff(domEl.nodeValue, String(vnode))) domEl.nodeValue = String(vnode);
        domIdx++;
      } else {
        const node = document.createTextNode(String(vnode));
        if (domEl) domEl.replaceWith(node);
        else target.appendChild(node);
        domIdx++;
      }
      continue;
    }

    if (isArray(vnode)) {
      for (const item of vnode) {
        hydrateElement(target, item, svg, cb);
      }
      continue;
    }
  }

  while (domIdx < domChildren.length) {
    domChildren[domIdx].remove();
    domIdx++;
  }

  return target;
}

function findHydrateOpen(domChildren, fromIdx) {
  for (let i = fromIdx; i < domChildren.length; i++) {
    if (domChildren[i].nodeType === 8 && domChildren[i].nodeValue === '[') {
      return domChildren[i];
    }
  }
  return null;
}

function findHydrateClose(domChildren, fromIdx) {
  let depth = 1;
  for (let i = fromIdx; i < domChildren.length; i++) {
    if (domChildren[i].nodeType === 8) {
      if (domChildren[i].nodeValue === '[') depth++;
      else if (domChildren[i].nodeValue === ']') {
        depth--;
        if (depth === 0) return i;
      }
    }
  }
  return -1;
}

function collectBetween(start, end) {
  const nodes = [];
  let node = start.nextSibling;
  while (node && node !== end) {
    nodes.push(node);
    node = node.nextSibling;
  }
  return nodes;
}

export function mountElement(target, view, svg, cb) {
  if (isFunction(view) && typeof svg === 'undefined' && typeof cb === 'undefined') {
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
  if (isScalar(next) || (!isNode(prev) || prev[0] !== next[0] || target.nodeType !== 1)) {
    return replaceElement(target, next, svg, cb);
  }

  if (updateProps(target, prev[1] || [], next[1] || [], svg, cb)) {
    if (isFunction(target.onupdate)) await target.onupdate(target);
    if (isFunction(target.update)) await target.update();
  }

  return next[1] && next[1]['@html']
    ? target : updateElement(target, toFragment(prev), toFragment(next), svg, cb);
}

export async function upgradeElements(target, vnode, svg, cb) {
  const tasks = [];
  const next = toArray(vnode);
  const c = Math.max(target.childNodes.length, next.length);

  const oldChildren = Array.from(target.childNodes);
  const oldByKey = new Map();
  const usedKeys = new Set();

  for (let i = 0; i < oldChildren.length; i++) {
    const key = getKeyFromNode(oldChildren[i]);
    if (key) {
      oldByKey.set(key, { el: oldChildren[i], index: i });
    }
  }

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
    const yKey = getKey(y);

    if (isNot(y)) {
      tasks.push({ rm: el });
      old = null;
    } else if (isNot(x)) {
      if (yKey && oldByKey.has(yKey) && !usedKeys.has(yKey)) {
        const oldEl = oldByKey.get(yKey).el;
        const oldIdx = oldByKey.get(yKey).index;
        usedKeys.add(yKey);
        if (oldIdx < off) {
          tasks.push({ move: oldEl, target: el });
          off++;
        } else {
          tasks.push({ patch: toNodes(oldEl), with: y, target: oldEl });
          usedKeys.add(yKey);
        }
      } else {
        tasks.push({ add: y });
        off++;
      }
    } else {
      const xKey = getKeyFromNode(el);
      if (yKey && yKey === xKey && !usedKeys.has(yKey)) {
        tasks.push({ patch: x, with: y, target: el });
        usedKeys.add(yKey);
        off++;
      } else if (yKey && oldByKey.has(yKey) && !usedKeys.has(yKey)) {
        const oldEl = oldByKey.get(yKey).el;
        tasks.push({ move: oldEl, target: el });
        usedKeys.add(yKey);
        off++;
      } else {
        tasks.push({ patch: x, with: y, target: el });
        off++;
      }
    }
  }

  if (off !== target.childNodes.length) {
    for (let k = target.childNodes.length; k > off; k--) {
      const child = target.childNodes[k - 1];
      const key = getKeyFromNode(child);
      if (!key || !usedKeys.has(key)) {
        tasks.push({ rm: child });
      }
    }
  }

  for (const task of tasks) {
    if (task.rm) await destroyElement(task.rm);
    if (!isNot(task.add)) insertElement(target, task.add, svg, cb);
    if (task.move) {
      if (canMove()) {
        target.moveBefore(task.move, task.target);
      } else {
        target.insertBefore(task.move, task.target);
      }
    }
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
