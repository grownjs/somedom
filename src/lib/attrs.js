import {
  camelCase,
} from './util.js';

import {
  XLINK_PREFIX, XLINK_NS,
  isDiff, isEmpty, isArray, isObject, isFunction, isScalar, isSignal,
} from './shared.js';

import { effect } from './signals.js';

const SIGNAL_PREFIX = 's:';
const DIRECTIVE_PREFIX = 'd:';

function isSignalProp(prop) {
  return prop.indexOf(SIGNAL_PREFIX) === 0;
}

function isDirective(prop) {
  return prop.indexOf(DIRECTIVE_PREFIX) === 0;
}

function bindDirective(target, prop, val) {
  const directive = prop.slice(DIRECTIVE_PREFIX.length);

  if (!target._directiveDisposers) {
    target._directiveDisposers = new Map();
  }

  if (target._directiveDisposers.has(prop)) {
    target._directiveDisposers.get(prop)();
  }

  let dispose;

  switch (directive) {
    case 'show':
      dispose = effect(() => {
        target.style.display = val.value ? '' : 'none';
      });
      break;

    case 'hide':
      dispose = effect(() => {
        target.style.display = val.value ? 'none' : '';
      });
      break;

    case 'class': {
      const className = val.className || 'active';
      dispose = effect(() => {
        target.classList.toggle(className, !!val.value);
      });
      break;
    }

    case 'model': {
      const field = val;
      const input = target;
      input.value = field.value;

      const handler = () => {
        field.value = input.value;
      };

      input.addEventListener('input', handler);

      dispose = effect(() => {
        if (document.activeElement !== input) {
          input.value = field.value;
        }
      });

      dispose._cleanup = () => {
        input.removeEventListener('input', handler);
      };
      break;
    }

    case 'text':
      dispose = effect(() => {
        target.textContent = val.value;
      });
      break;

    case 'html':
      dispose = effect(() => {
        target.innerHTML = val.value;
      });
      break;

    case 'click-outside': {
      const callback = val;
      const handler = e => {
        if (!target.contains(e.target)) {
          callback(e);
        }
      };
      document.addEventListener('click', handler);
      dispose = () => document.removeEventListener('click', handler);
      break;
    }

    default:
      return;
  }

  target._directiveDisposers.set(prop, dispose);
}

function cleanupDirectives(target) {
  if (target._directiveDisposers) {
    target._directiveDisposers.forEach(dispose => {
      if (dispose._cleanup) dispose._cleanup();
      dispose();
    });
    target._directiveDisposers.clear();
  }
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
      target.textContent = value == null ? '' : String(value);
    } else if (domProp === 'innerHTML') {
      target.innerHTML = value == null ? '' : String(value);
    } else if (domProp.startsWith('style.')) {
      target.style[domProp.slice(6)] = value;
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
    } else if (isDirective(prop)) {
      if (val && typeof val === 'object' && 'value' in val) {
        bindDirective(target, prop, val);
        const originalTeardown = target.teardown;
        target.teardown = () => {
          cleanupDirectives(target);
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
        bindSignalProp(target, `${SIGNAL_PREFIX}${name}`, val);
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
      if (isDirective(k) && !(k in next)) {
        if (target._directiveDisposers && target._directiveDisposers.has(k)) {
          const dispose = target._directiveDisposers.get(k);
          if (dispose._cleanup) dispose._cleanup();
          dispose();
          target._directiveDisposers.delete(k);
        }
      }
    });
    assignProps(target, props, svg, cb);
  }
  return changed;
}
