import {
  camelCase,
} from './util.js';

import {
  XLINK_PREFIX, XLINK_NS,
  isDiff, isEmpty, isArray, isObject, isFunction, isScalar,
} from './shared.js';

export function assignProps(target, attrs, svg, cb) {
  Object.entries(attrs).forEach(([prop, val]) => {
    if (prop === 'key') return;
    if (prop === 'ref') {
      target.oncreate = el => {
        val.current = el;
      };
    } else if (prop === '@html') {
      target.innerHTML = val;
    } else if (prop.indexOf('class:') === 0) {
      if (!val) {
        target.classList.remove(prop.substr(6));
      } else {
        target.classList.add(prop.substr(6));
      }
    } else if (prop.indexOf('style:') === 0) {
      target.style[camelCase(prop.substr(6))] = val;
    } else {
      const name = prop.replace('@', 'data-').replace(XLINK_PREFIX, '');

      // eslint-disable-next-line no-nested-ternary
      let value = val !== true ? val : (name.includes('-') ? true : name);
      if (isObject(value)) {
        value = (isFunction(cb) && cb(target, name, value)) || value;
        value = value !== target ? value : null;
        value = isArray(value)
          ? value.join('')
          : value;
      }

      const removed = isEmpty(value);

      if (svg && prop !== name) {
        if (removed) target.removeAttributeNS(XLINK_NS, name);
        else target.setAttributeNS(XLINK_NS, name, value);
        return;
      }

      if (removed) target.removeAttribute(name);
      else if (isScalar(value)) target.setAttribute(name, value);
    }
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
