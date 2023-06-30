import {
  camelCase,
} from './util.js';

import {
  XLINK_PREFIX, XLINK_NS,
  toKeys, isDiff, isEmpty, isArray, isObject, isFunction, isScalar,
} from './shared.js';

export function assignProps(target, attrs, svg, cb) {
  for (let i = 0; i < attrs.length; i += 2) {
    const prop = attrs[i];
    const val = attrs[i + 1];

    if (prop === 'key') continue;
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
        continue;
      }

      if (removed) target.removeAttribute(name);
      else if (isScalar(value)) target.setAttribute(name, value);
    }
  }
}

export function updateProps(target, prev, next, svg, cb) {
  const [old, keys] = [prev, next].map(toKeys);
  const set = prev.concat(next);
  const data = new Map();
  const props = [];

  for (let i = 0; i < set.length; i += 2) {
    const k = set[i];
    const v = set[i + 1];

    /* istanbul ignore else */
    if (old.includes(k)) {
      if (!data.has(k)) data.set(k, v);
      if (!keys.includes(k)) props.push(k, null);
      else if (isDiff(data.get(k), v, true)) props.push(k, v);
    } else if (isDiff(data.get(k), v, true)) props.push(k, v);
  }

  if (props.length > 0) {
    assignProps(target, props, svg, cb);
    return true;
  }
}
