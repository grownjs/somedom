import {
  isEmpty, isObject, isFunction, isScalar, isPlain, isDiff, isNode, isArray,
} from './util';

import { XLINK_NS, ELEM_REGEX } from './shared';

export function fixProps(vnode) {
  if (isArray(vnode) && isArray(vnode[1])) {
    vnode[2] = vnode[1];
    vnode[1] = null;
  }

  if (!isNode(vnode) || isFunction(vnode[0])) return vnode;

  let attrs = isPlain(vnode[1])
    ? { ...vnode[1] }
    : null;

  const matches = vnode[0].match(ELEM_REGEX);

  vnode[0] = matches[1] || 'div';

  if (matches[2]) {
    attrs = vnode[1] = attrs || {};
    attrs.id = matches[2].substr(1);
  }

  if (matches[3]) {
    attrs = vnode[1] = attrs || {};

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

  return vnode;
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

    if (prop === '@html') {
      target.innerHTML = attrs[prop];
      return;
    }

    let value = attrs[prop] !== true ? attrs[prop] : prop;
    if (isObject(value)) {
      value = (isFunction(cb) && cb(target, prop, value)) || value;
      value = value !== target ? value : null;
      value = isArray(value)
        ? value.join('')
        : value;
    }

    const removed = isEmpty(value);
    const name = prop.replace(/^xlink:?/, '');

    if (svg && prop !== name) {
      if (removed) target.removeAttributeNS(XLINK_NS, name);
      else target.setAttributeNS(XLINK_NS, name, value);
      return;
    }

    if (removed) target.removeAttribute(prop);
    else if (isScalar(value)) target.setAttribute(prop, value);
  });
}

export function updateProps(target, prev, next, svg, cb) {
  const keys = Object.keys(prev).concat(Object.keys(next));
  let changed;

  const props = keys.reduce((all, k) => {
    if (k in prev && !(k in next)) {
      all[k] = null;
      changed = true;
    } else if (isDiff(prev[k], next[k], true)) {
      all[k] = next[k];
      changed = true;
    }

    return all;
  }, {});

  if (changed) assignProps(target, props, svg, cb);

  return changed;
}
