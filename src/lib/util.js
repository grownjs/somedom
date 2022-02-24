/* eslint-disable no-plusplus, no-continue */

import {
  ELEM_REGEX,
  SKIP_METHODS,
  RE_XML_SPLIT,
  RE_XML_CLOSE_END,
  RE_XML_CLOSE_BEGIN,
} from './shared';

import Fragment, { BEGIN, END } from './fragment';

export const isString = value => typeof value === 'string';
export const isFunction = value => typeof value === 'function';
export const isSelector = value => isString(value) && ELEM_REGEX.test(value);
export const isNot = value => typeof value === 'undefined' || value === null;
export const isPlain = value => value !== null && Object.prototype.toString.call(value) === '[object Object]';
export const isObject = value => value !== null && (typeof value === 'function' || typeof value === 'object');
export const isScalar = value => isString(value) || typeof value === 'number' || typeof value === 'boolean';

export const isArray = value => Array.isArray(value);
export const isBegin = value => value === BEGIN || (value && value.__mark === BEGIN);
export const isEnd = value => value === END || (value && value.__mark === END);
export const isBlock = value => isArray(value) && !isNode(value);

export function flat(value) {
  return !isArray(value) ? value : value.reduce((memo, n) => memo.concat(isNode(n) ? [n] : flat(n)), []);
}

export function isEmpty(value) {
  if (isFunction(value)) return false;
  if (isArray(value)) return value.length === 0;
  if (isPlain(value)) return Object.keys(value).length === 0;

  return isNot(value) || value === false;
}

export function isNode(value) {
  if (!isArray(value)) return false;
  if (typeof value[0] === 'function') return true;
  if (typeof value[1] !== 'object' || isArray(value[1])) return false;
  if (typeof value[0] !== 'string' || value[0].includes(' ')) return false;
  return true;
}

export function zip(set, prev, next, offset, left, right, cb, d = 0) {
  const c = Math.max(prev.length, next.length);

  function get(el) {
    while (el && el.__dirty) el = el[++offset];
    return el;
  }

  let i = 0;
  let a = 0;
  let b = 0;
  for (; i < c; i++) {
    let el = set[offset];
    while (el && (el.__dirty || isEnd(el))) el = el[++offset];

    const x = flat(prev[a]);
    const y = flat(next[b]);

    if (isNot(x)) {
      cb({ add: y });
    } else if (isNot(y)) {
      if (isBegin(el)) {
        const k = el.__length + 2;
        for (let p = 0; p < k; p++) {
          cb({ rm: get(set[offset++]) });
        }
      } else if (isBlock(x)) {
        let k = x.length;
        if (!set[offset]) offset -= k;
        while (k--) cb({ rm: get(set[offset++]) });
      } else if (el) {
        cb({ rm: el });
        offset++;
      }
    } else if (isBlock(x) && isBlock(y)) {
      if (isBegin(el)) {
        cb({ patch: x, with: y, target: el });
        offset += el.__length + 2;
      } else {
        zip(set, x, y, offset, 0, 0, cb, d + 1);
        offset += y.length + 2;
      }
    } else if (isBlock(y)) {
      cb({ patch: [x], with: y, target: el });
      offset += y.length;
    } else if (el) {
      cb({ patch: x, with: y, target: el });
      if (isBegin(el)) {
        offset += el.__length + 2;
      } else {
        offset++;
      }
    } else {
      cb({ add: y });
      offset++;
    }

    a++;
    b++;
  }

  if (offset !== set.length) {
    for (let k = offset; k < set.length; k++) {
      if (isEnd(set[k])) break;
      cb({ rm: set[k] });
    }
  }
}

export function isDiff(prev, next) {
  if (typeof prev !== typeof next) return true;
  if (isArray(prev)) {
    if (prev.length !== next.length) return true;

    for (let i = 0; i < next.length; i += 1) {
      if (isDiff(prev[i], next[i])) return true;
    }
  } else if (isPlain(prev) && isPlain(next)) {
    const a = Object.keys(prev).sort();
    const b = Object.keys(next).sort();

    if (isDiff(a, b)) return true;

    for (let i = 0; i < a.length; i += 1) {
      if (isDiff(prev[a[i]], next[b[i]])) return true;
    }
  } else return prev !== next;
}

export function getMethods(obj) {
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
}

export const dashCase = value => value.replace(/[A-Z]/g, '-$&').toLowerCase();
export const toArray = value => (!isEmpty(value) && !isArray(value) ? [value] : value) || [];
export const filter = (value, cb) => value.filter(cb || (x => !isEmpty(x)));

export function plain(target, re) {
  if (typeof target === 'object' && 'length' in target && !target.nodeType) return Array.from(target).map(x => plain(x, re));
  if (re && target.nodeType === 1) return target.outerHTML;
  if (target.nodeType === 3) return target.nodeValue;
  return Array.from(target.childNodes).map(x => plain(x, true));
}

export function format(markup) {
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
}

export function trim(value) {
  const matches = value.match(/\n( )*/);
  const spaces = matches[0].substr(0, matches[0].length - 1);
  const depth = spaces.split('').length;

  return value.replace(new RegExp(`^ {${depth}}`, 'mg'), '').trim();
}

export function clone(value) {
  if (!value || !isObject(value)) return value;
  if (isArray(value)) return value.map(x => clone(x));
  if (value instanceof Date) return new Date(value.getTime());
  if (value instanceof RegExp) return new RegExp(value.source, value.flags);
  return Object.keys(value).reduce((memo, k) => Object.assign(memo, { [k]: clone(value[k]) }), {});
}

export const apply = (cb, length, options = {}) => (...args) => length === args.length && cb(...args, options);
export const raf = cb => ((typeof window !== 'undefined' && window.requestAnimationFrame) || setTimeout)(cb);
export const tick = cb => Promise.resolve().then(cb).then(() => new Promise(done => raf(done)));

export const remove = (target, node) => target && target.removeChild(node);
export const replace = (target, node, i) => target.replaceChild(node, target.childNodes[i]);
export const append = (target, node) => (Fragment.valid(node) ? node.mount(target) : target.appendChild(node));

export const detach = (target, node) => {
  if (node) {
    if (Fragment.valid(node)) {
      node.mount(target.parentNode, target);
    } else {
      target.parentNode.insertBefore(node, target);
    }
  }
  remove(target.parentNode, target);
};
