import {
  camelCase,
} from './util.js';

import {
  XLINK_PREFIX, XLINK_NS,
  isDiff, isEmpty, isArray, isObject, isFunction, isScalar, isSignal,
} from './shared.js';

import { effect } from './signals.js';

const SIGNAL_PREFIX = 'signal:';

function isSignalProp(prop) {
  return prop.indexOf(SIGNAL_PREFIX) === 0;
}

function bindSignalProp(target, prop, signal) {
  const domProp = prop.slice(SIGNAL_PREFIX.length);

  if (!target._signalDisposers) {
    target._signalDisposers = new Map();
  }

  if (target._signalDisposers.has(prop)) {
    target._signalDisposers.get(prop)();
  }

  const dispose = effect(() => {
    const value = signal.value;
    if (domProp === 'textContent') {
      target.textContent = value;
    } else if (domProp === 'innerHTML') {
      target.innerHTML = value;
    } else {
      target[domProp] = value;
    }
  });

  target._signalDisposers.set(prop, dispose);
}

function cleanupSignalProps(target) {
  if (target._signalDisposers) {
    target._signalDisposers.forEach(dispose => dispose());
    target._signalDisposers.clear();
  }
}

export function assignProps(target, attrs, svg, cb) {
  Object.entries(attrs).forEach(([prop, val]) => {
    if (prop === 'key' || prop === 'open') return;
    if (prop === 'ref') {
      target.oncreate = el => {
        val.current = el;
      };
    } else if (prop === '@html') {
      target.innerHTML = val;
    } else if (isSignalProp(prop)) {
      if (val && typeof val === 'object' && 'value' in val) {
        bindSignalProp(target, prop, val);
        const originalTeardown = target.teardown;
        target.teardown = () => {
          cleanupSignalProps(target);
          if (originalTeardown) originalTeardown();
        };
      }
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

      if (isSignal(val)) {
        bindSignalProp(target, 'signal:' + name, val);
        const originalTeardown = target.teardown;
        target.teardown = () => {
          cleanupSignalProps(target);
          if (originalTeardown) originalTeardown();
        };
        return;
      }

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

  if (changed) {
    Object.keys(prev).forEach(k => {
      if (isSignalProp(k) && !(k in next)) {
        if (target._signalDisposers && target._signalDisposers.has(k)) {
          target._signalDisposers.get(k)();
          target._signalDisposers.delete(k);
        }
      }
    });
    assignProps(target, props, svg, cb);
  }
  return changed;
}
