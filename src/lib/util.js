import {
  ELEM_REGEX,
  SKIP_METHODS,
  RE_XML_SPLIT,
  RE_XML_CLOSE_END,
  RE_XML_CLOSE_BEGIN,
} from './shared';

import Fragment from './fragment';

export const isArray = value => Array.isArray(value);
export const isFunction = value => typeof value === 'function';
export const isSelector = value => value && ELEM_REGEX.test(value);
export const isUndef = value => typeof value === 'undefined' || value === null;
export const isPlain = value => value !== null && Object.prototype.toString.call(value) === '[object Object]';
export const isObject = value => value !== null && (typeof value === 'function' || typeof value === 'object');
export const isScalar = value => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';

export const isDiff = (prev, next) => {
  if (isFunction(prev) || isFunction(next) || typeof prev !== typeof next) return true;
  if (isArray(prev)) {
    if (prev.length !== next.length) return true;

    for (let i = 0; i < next.length; i += 1) {
      if (isDiff(prev[i], next[i])) return true;
    }
  } else if (isPlain(prev)) {
    const a = Object.keys(prev).sort();
    const b = Object.keys(next).sort();

    if (isDiff(a, b)) return true;

    for (let i = 0; i < a.length; i += 1) {
      if (isDiff(prev[a[i]], next[b[i]])) return true;
    }
  } else return prev !== next;
};

export const isEmpty = value => {
  if (isFunction(value)) return false;
  if (isArray(value)) return value.length === 0;
  if (isPlain(value)) return Object.keys(value).length === 0;

  return isUndef(value) || value === '' || value === false;
};

export const isNode = x => isArray(x)
  && ((typeof x[0] === 'string' && isSelector(x[0])) || isFunction(x[0]))
  && (typeof x[1] === 'object' || isFunction(x[0]));

export const getMethods = obj => {
  const stack = [];

  do {
    stack.push(obj);
  } while (obj = Object.getPrototypeOf(obj)); // eslint-disable-line

  stack.pop();

  return stack.reduce((memo, cur) => {
    const keys = Object.getOwnPropertyNames(cur);

    keys.forEach(key => {
      if (!SKIP_METHODS.includes(key)
        && isFunction(cur[key])
        && !memo.includes(key)
      ) memo.push(key);
    });

    return memo;
  }, []);
};

export const dashCase = value => value.replace(/[A-Z]/g, '-$&').toLowerCase();
export const toArray = value => (!isEmpty(value) && !isArray(value) ? [value] : value) || [];
export const filter = (value, cb) => value.filter(cb || (x => !isEmpty(x)));

export const format = markup => {
  let formatted = '';
  let pad = 0;

  markup = markup.replace(RE_XML_SPLIT, '$1\n$2$3');
  markup.split('\n').forEach(line => {
    let indent = 0;
    if (RE_XML_CLOSE_END.test(line)) {
      indent = 0;
    } else if (RE_XML_CLOSE_BEGIN.test(line)) {
      if (pad !== 0) {
        pad -= 1;
      }
    } else {
      indent = 1;
    }

    const padding = Array.from({ length: pad + 1 }).join('  ');

    formatted += `${padding + line}\n`;
    pad += indent;
  });

  return formatted.trim();
};

export const trim = value => {
  const matches = value.match(/\n( )*/);
  const spaces = matches[0].substr(0, matches[0].length - 1);
  const depth = spaces.split('').length;

  return value.replace(new RegExp(`^ {${depth}}`, 'mg'), '').trim();
};

export const clone = value => {
  if (!value || !isObject(value)) return value;
  if (isArray(value)) return value.map(x => clone(x));
  if (value instanceof Date) return new Date(value.getTime());
  if (value instanceof RegExp) return new RegExp(value.source, value.flags);
  return Object.keys(value).reduce((memo, k) => Object.assign(memo, { [k]: clone(value[k]) }), {});
};

export function offsetAt(target, cb) {
  let offset = -1;
  for (let i = 0; i < target.childNodes.length; i += 1) {
    if (cb(target.childNodes[i])) {
      offset = i;
      break;
    }
  }
  return offset;
}

export function sortedZip(prev, next, cb, o = -1) {
  const length = Math.max(prev.length, next.length);

  for (let i = 0; i < length; i += 1) {
    if (isDiff(prev[i], next[i])) {
      cb(prev[i] || null, !isUndef(next[i]) ? next[i] : null, i + o + 1);
    }
  }
}

export const apply = (cb, length, options = {}) => (...args) => length === args.length && cb(...args, options);
export const raf = cb => ((typeof window !== 'undefined' && window.requestAnimationFrame) || setTimeout)(cb);
export const tick = cb => Promise.resolve(cb && cb()).then(() => new Promise(done => raf(done)));

export const append = (target, node) => (node instanceof Fragment ? node.mount(target) : target.appendChild(node));
export const replace = (target, node, i) => target.replaceChild(node, target.childNodes[i]);
export const remove = (target, node) => target && target.removeChild(node);

export const detach = (target, node) => {
  if (node) {
    if (node instanceof Fragment) {
      node.mount(target.parentNode, target);
    } else {
      target.parentNode.insertBefore(node, target);
    }
  }
  remove(target.parentNode, target);
};
