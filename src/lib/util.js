import {
  IS_ARRAY,
  RE_XML_SPLIT,
  RE_XML_CLOSE_END,
  RE_XML_CLOSE_BEGIN,
  isEmpty, isArray, isNode, isFunction, toProxy, toArray, toFragment,
} from './shared.js';

import Fragment from './fragment.js';

export function freeze(value) {
  if (isArray(value) && !(IS_ARRAY in value)) {
    while (value.length === 1 && !isFunction(value[0])) value = value[0];

    Object.defineProperty(value, IS_ARRAY, { value: 1 });

    if (isNode(value)) {
      let fn;
      while (value && isFunction(value[0])) {
        fn = value[0];
        value = fn(toProxy(value[1]), toArray(toFragment(value), freeze));
      }

      if (value instanceof Fragment) return value;

      if (isNode(value) && !(IS_ARRAY in value)) {
        Object.defineProperty(value, IS_ARRAY, { value: 1 });

        value[2] = toArray(toFragment(value), freeze);
        value[1] = toProxy(value[1]);
        value.length = 3;
      }
    }
  }
  return value;
}

export const camelCase = value => value.replace(/-([a-z])/g, (_, $1) => $1.toUpperCase());
export const dashCase = value => value.replace(/[A-Z]/g, '-$&').toLowerCase();
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
  if (isArray(value)) return value.map(x => clone(x));
  if (value instanceof Date) return new Date(value.getTime());
  if (value instanceof RegExp) return new RegExp(value.source, value.flags);
  return Object.keys(value).reduce((memo, k) => Object.assign(memo, { [k]: clone(value[k]) }), {});
}

export const apply = (cb, length, options = {}) => (...args) => length === args.length && cb(...args, options);
export const raf = cb => ((typeof window !== 'undefined' && window.requestAnimationFrame) || setTimeout)(cb);
export const tick = cb => Promise.resolve().then(cb).then(() => new Promise(done => raf(done)));

export const append = (target, node) => target.appendChild(node);
export const remove = (target, node) => target && target.removeChild(node);
export const replace = (target, node, i) => target.replaceChild(node, target.childNodes[i]);

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
