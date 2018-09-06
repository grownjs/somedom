export const isArray = value => Array.isArray(value);
export const isFunction = value => typeof value === 'function';
export const isUndef = value => typeof value === 'undefined' || value === null;
export const isObject = value => value !== null && (typeof value === 'function' || typeof value === 'object');
export const isScalar = value => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';

export const isDiff = (prev, next) => {
  if (isFunction(prev) || isFunction(next) || typeof prev !== typeof next) return true;
  if (isArray(prev)) {
    if (prev.length !== next.length) return true;
    if (prev.some(x => next.indexOf(x) === -1)) return true;
  } else if (isObject(prev)) {
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
  if (isObject(value)) return Object.keys(value).length === 0;

  return typeof value === 'undefined' || value === '' || value === null || value === false;
};

export const isNode = x => isArray(x) && x.length <= 3 && (typeof x[0] === 'string' || typeof x[0] === 'function') && !isEmpty(x[0]);

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

export const zipMap = (a, b, cb) => Array.from({ length: Math.max(a.length, b.length) }).map((_, i) => cb(a[i], b[i], i));
export const apply = (cb, length, options = {}) => (...args) => length === args.length && cb(...args, options);
export const raf = cb => ((typeof window !== 'undefined' && window.requestAnimationFrame) || setTimeout)(cb);

export const replace = (target, node, i) => target.replaceChild(node, target.childNodes[i]);
export const remove = (target, node) => target && target.removeChild(node);
export const append = (target, node) => target.appendChild(node);
export const detach = target => remove(target.parentNode, target);
