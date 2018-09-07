import {
  isEmpty, isObject, isFunction, isScalar, isDiff, isNode, isArray, toArray,
} from './util';

export const XLINK_NS = 'http://www.w3.org/1999/xlink';
export const ELEM_REGEX = /(\w*)(#\w+)?([\w.]+)?/;

export function fixTree(vnode) {
  vnode = isNode(vnode) && isFunction(vnode[0])
    ? fixTree(vnode[0](vnode[1], toArray(vnode[2])))
    : vnode;

  if (isArray(vnode[2])) {
    vnode[2].forEach((sub, i) => {
      if (isNode(sub)) {
        vnode[2][i] = fixTree(sub);
      }
    });
  }

  return vnode;
}

export function fixProps(vnode) {
  if (isArray(vnode[1]) || isScalar(vnode[1])) {
    vnode[2] = vnode[1];
    vnode[1] = null;
  }

  if (isFunction(vnode[0])) {
    vnode = fixProps(vnode[0](vnode[1], toArray(vnode[2])));
  }

  if (!isNode(vnode)) throw new Error(`Invalid vnode, given '${vnode}'`);

  const matches = vnode[0].match(ELEM_REGEX);
  const name = matches[1] || 'div';
  const attrs = { ...vnode[1] };

  if (matches[2]) {
    attrs.id = matches[2].substr(1);
  }

  if (matches[3]) {
    const classes = matches[3].substr(1).split('.');

    if (isObject(attrs.class)) {
      classes.forEach(x => { attrs.class[x] = 1; });
    } else if (isArray(attrs.class) || isScalar(attrs.class)) {
      attrs.class = !isArray(attrs.class) ? attrs.class.split(' ') : attrs.class;
      attrs.class = classes.concat(attrs.class).reduce((prev, cur) => {
        if (prev.indexOf(cur) === -1) prev.push(cur);
        return prev;
      }, []);
    } else {
      attrs.class = classes;
    }
  }

  return [name, attrs, toArray(vnode[2])];
}

export function assignProps(target, attrs, svg, cb) {
  Object.keys(attrs).forEach(prop => {
    if (prop === 'key' || isObject(attrs[prop])) {
      attrs[prop] = (isFunction(cb) && cb(target, prop, attrs[prop])) || null;

      if (prop === 'key') return;
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
  let changed;

  const keys = Object.keys(prev).concat(Object.keys(next));
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
