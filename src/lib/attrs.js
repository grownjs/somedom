import {
  isEmpty, isObject, isFunction, isScalar, isPlain, isDiff, isNode, isArray,
} from './util';

import { XLINK_NS, ELEM_REGEX } from './shared';

import Fragment from './fragment';

export function fixTree(vnode) {
  if (isArray(vnode)) {
    if (isNode(vnode)) {
      if (isArray(vnode[1])) {
        vnode[1] = vnode[1].map(fixTree);
      }
      if (isFunction(vnode[0])) {
        return fixTree(vnode[0](vnode[1], vnode.slice(2)));
      }
      if (vnode.length > 2) {
        const nextTree = vnode.slice(2).reduce((memo, it) => {
          const subTree = fixTree(it);

          if (isArray(subTree) && !isNode(subTree)) {
            if (!subTree.some(isNode)) {
              memo.push(...subTree.reduce((prev, cur) => prev.concat(cur), []));
            } else {
              memo.push(...subTree);
            }
          } else {
            memo.push(subTree);
          }
          return memo;
        }, []);

        vnode.length = 2;
        vnode.push(...nextTree);
      }
      return vnode;
    }

    let newTree = vnode.reduce((memo, el) => {
      const lastNode = memo[memo.length - 1];
      const newNode = fixTree(el);

      if (typeof lastNode === 'string' && typeof newNode === 'string') {
        memo[memo.length - 1] += newNode;
      } else {
        memo.push(newNode);
      }
      return memo;
    }, []);

    if (!newTree.some(x => isArray(x) || x instanceof Fragment)) {
      return newTree.join('');
    }

    while (newTree.length === 1) newTree = newTree[0];
    return newTree;
  }
  return vnode;
}

export function fixProps(vnode, re) {
  if (isScalar(vnode) || !isNode(vnode)) return vnode;

  const children = vnode.slice(isArray(vnode[1]) ? 1 : 2)
    .reduce((memo, it) => {
      if (re && isNode(it)) {
        memo.push(fixProps(it, re));
      } else {
        return memo.concat(it);
      }
      return memo;
    }, []);

  let attrs = isPlain(vnode[1])
    ? { ...vnode[1] }
    : null;

  if (isFunction(vnode[0])) {
    return [vnode[0], attrs, ...children];
  }

  const matches = vnode[0].match(ELEM_REGEX);
  const tag = matches[1] || 'div';

  if (matches[2]) {
    attrs = attrs || {};
    attrs.id = matches[2].substr(1);
  }

  if (matches[3]) {
    attrs = attrs || {};

    const classes = matches[3].substr(1).split('.');

    if (isArray(attrs.class) || isScalar(attrs.class)) {
      attrs.class = !isArray(attrs.class) ? attrs.class.split(/\W/) : attrs.class;
      attrs.class = classes.concat(attrs.class).reduce((prev, cur) => {
        if (prev.indexOf(cur) === -1) prev.push(cur);
        return prev;
      }, []);
    } else if (isObject(attrs.class)) {
      classes.forEach(x => { attrs.class[x] = 1; });
    } else {
      attrs.class = classes;
    }
  }

  return [tag, attrs, ...children];
}

export function assignProps(target, attrs, svg, cb) {
  Object.keys(attrs).forEach(prop => {
    if (prop === 'key') return;

    if (prop === 'ref') {
      target.oncreate = el => {
        attrs[prop].current = el;
      };
      return;
    }

    if (isObject(attrs[prop])) {
      attrs[prop] = (isFunction(cb) && cb(target, prop, attrs[prop])) || null;
    }

    const removed = isEmpty(attrs[prop]);
    const value = attrs[prop] === true ? prop : attrs[prop];
    const name = prop.replace(/^xlink:?/, '');

    if (svg && prop !== name) {
      if (removed) target.removeAttributeNS(XLINK_NS, name);
      else target.setAttributeNS(XLINK_NS, name, value);
      return;
    }

    if (removed) target.removeAttribute(prop);
    else target.setAttribute(prop, value);
  });
}

export function updateProps(target, prev, next, svg, cb) {
  const keys = Object.keys(prev).concat(Object.keys(next));
  let changed;

  const props = keys.reduce((all, k) => {
    if (k in prev && !(k in next)) {
      all[k] = null;
      changed = true;
    } else if (isDiff(prev[k], next[k])) {
      all[k] = next[k];
      changed = true;
    }

    return all;
  }, {});

  if (changed) assignProps(target, props, svg, cb);

  return changed;
}
