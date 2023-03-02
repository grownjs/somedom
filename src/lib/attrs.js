import {
  isEmpty, isObject, isFunction, isScalar, isDiff, isArray, camelCase,
} from './util';

import { XLINK_PREFIX, XLINK_NS } from './shared';

export function assignProps(target, attrs, svg, cb) {
  Object.keys(attrs).forEach(prop => {
    if (prop === 'key') return;
    if (prop === 'ref') {
      target.oncreate = el => {
        attrs[prop].current = el;
      };
    } else if (prop === '@html') {
      target.innerHTML = attrs[prop];
    } else if (prop.charAt() === '@') {
      target.setAttribute(`data-${prop.substr(1)}`, attrs[prop]);
    } else if (prop.indexOf('class:') === 0) {
      if (!attrs[prop]) {
        target.classList.remove(prop.substr(6));
      } else {
        target.classList.add(prop.substr(6));
      }
    } else if (prop.indexOf('style:') === 0) {
      target.style[camelCase(prop.substr(6))] = attrs[prop];
    } else {
      let value = attrs[prop] !== true ? attrs[prop] : prop;
      if (isObject(value)) {
        value = (isFunction(cb) && cb(target, prop, value)) || value;
        value = value !== target ? value : null;
        value = isArray(value)
          ? value.join('')
          : value;
      }

      const removed = isEmpty(value);
      const name = prop.replace(XLINK_PREFIX, '');

      if (svg && prop !== name) {
        if (removed) target.removeAttributeNS(XLINK_NS, name);
        else target.setAttributeNS(XLINK_NS, name, value);
        return;
      }

      if (removed) target.removeAttribute(prop);
      else if (isScalar(value)) target.setAttribute(prop, value);
    }
  });
}

export function updateProps(target, prev, next, svg, cb) {
  const keys = Object.keys(prev).concat(Object.keys(next));

  let changed;
  const props = keys.reduce((all, k) => {
    if (k !== '@html') {
      if (k in prev && !(k in next)) {
        all[k] = null;
        changed = true;
      } else if (isDiff(prev[k], next[k], true)) {
        all[k] = next[k];
        changed = true;
      }
    }
    return all;
  }, {});

  if (changed) assignProps(target, props, svg, cb);
  return changed;
}
