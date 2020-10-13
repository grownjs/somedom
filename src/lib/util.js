import { Fragment, ELEM_REGEX, SKIP_METHODS } from './shared';

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

  return typeof value === 'undefined' || value === '' || value === null || value === false;
};

export const isNode = x => isArray(x) && x.length <= 3 && ((typeof x[0] === 'string' && isSelector(x[0])) || isFunction(x[0]));

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
        && typeof cur[key] === 'function'
        && !memo.includes(key)
      ) memo.push(key);
    });

    return memo;
  }, []);
};

export const dashCase = value => value.replace(/[A-Z]/g, '-$&').toLowerCase();
export const toArray = value => (!isEmpty(value) && !isArray(value) ? [value] : value) || [];
export const filter = (value, cb) => value.filter(cb || (x => !isEmpty(x)));

export const format = value => {
  const xml = String(value)
    .replace(/^\s+|\s+$/g, '')
    .replace(/></g, '>\n<')
    .replace(/\/(\w+)></g, '/$1>\n<')
    .replace(/>(.+?)<([a-zA-Z])/g, '>\n$1\n<$2');

  const output = xml.split('\n');

  for (let i = 0, tabs = ''; i < output.length; i += 1) {
    const line = output[i].replace(/^\s+|\s+$/g, '');

    if (/^<[/]/.test(line)) {
      tabs = tabs.replace('  ', '');
      output[i] = tabs + line;
    } else if (/<.*>.*<\/.*>|<.*[^>]\/>/.test(line)) {
      output[i] = tabs + line;
    } else {
      output[i] = tabs + line;
      tabs += '  ';
    }
  }

  return output.join('\n');
};

export const trim = value => {
  const matches = value.match(/\n( )*/);
  const spaces = matches[0].substr(0, matches[0].length - 1);
  const depth = spaces.split('').length;

  return value.replace(new RegExp(`^ {${depth}}`, 'mg'), '').trim();
};

export const clone = value => {
  if (!value || typeof value !== 'object') return value;
  if (isArray(value)) return value.map(x => clone(x));
  if (value instanceof Date) return new Date(value.getTime());
  if (value instanceof RegExp) return new RegExp(value.source, value.flags);
  return Object.keys(value).reduce((memo, k) => Object.assign(memo, { [k]: clone(value[k]) }), {});
};

export function sortedZip(prev, next, cb) {
  const length = Math.max(prev.length, next.length);

  for (let i = 0; i < length; i += 1) {
    if (isDiff(prev[i], next[i])) {
      cb(prev[i] || null, next[i] || null, i);
    }
  }
}

export const apply = (cb, length, options = {}) => (...args) => length === args.length && cb(...args, options);
export const raf = cb => ((typeof window !== 'undefined' && window.requestAnimationFrame) || setTimeout)(cb);
export const tick = cb => new Promise(resolve => raf(() => resolve(cb && cb())));

export const append = (target, node) => (node instanceof Fragment ? node.mount(target) : target.appendChild(node));
export const replace = (target, node, i) => target.replaceChild(node, target.childNodes[i]);
export const remove = (target, node) => target && target.removeChild(node);

export const detach = (target, node) => {
  if (node) target.parentNode.insertBefore(node, target);
  remove(target.parentNode, target);
};
