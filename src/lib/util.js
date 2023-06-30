import {
  RE_XML_SPLIT,
  RE_XML_CLOSE_END,
  RE_XML_CLOSE_BEGIN,
  isNot, isPlain, isEmpty, isArray, isNode, isTuple, isFunction, toProxy, toFragment,
} from './shared.js';

import Fragment from './fragment.js';

export * from './shared.js';

export const SEEN_ARRAY = Symbol('@@seen');

export function lock(value) {
  if (isArray(value) && !(SEEN_ARRAY in value)) {
    while (value.length === 1 && !isFunction(value[0])) value = value[0];

    Object.defineProperty(value, SEEN_ARRAY, { value: 1 });

    if (isNode(value)) {
      let fn;
      while (value && isFunction(value[0])) {
        fn = value[0];
        value = fn(toProxy(value[1]), flatten(toFragment(value)));
      }

      if (value instanceof Fragment) return value;
      if (isNode(value) && !(SEEN_ARRAY in value)) {
        Object.defineProperty(value, SEEN_ARRAY, { value: 1 });

        value[2] = flatten(toFragment(value));
        value[1] = toProxy(value[1]);
        value.length = 3;
      }
    }
  }
  return value;
}

export function unlock(value) {
  delete value[SEEN_ARRAY];
}

export function flatten(value) {
  if (!isArray(value)) return value;
  if (isNode(value)) return lock(value);

  return value.reduce((memo, n) => {
    return memo.concat(isTuple(n) || isNode(n) ? [lock(n)] : flatten(n));
  }, []);
}

export function props(node) {
  if (node.attributes && !node.getAttributeNames) return [].concat(...Object.entries(node.attributes));
  const data = node.getAttributeNames().reduce((memo, key) => memo.concat([key, node.getAttribute(key)]), []);
  return data;
}

export function vdom(node) {
  if (isNot(node)) return;
  if (isArray(node)) return node.map(vdom);
  if (typeof NodeList !== 'undefined' && node instanceof NodeList) return vdom(node.values());
  if (node.nodeType === 1) return [node.tagName.toLowerCase(), props(node)];
  if (node.nodeType === 3) return node.nodeValue;
  if (node.childNodes) return node.childNodes.map(vdom);
  return vdom([...node]);
}

export async function morph(target, next, offset, cb) {
  const c = Math.max(target.childNodes.length, next.length);

  let i = 0;
  let old;
  let el;
  let x;
  for (; i < c; i += 1) {
    if (old !== offset) {
      el = target.childNodes[offset];
      x = vdom(el);
      old = offset;
    }

    const y = next.shift();

    if (isNot(y)) {
      cb({ rm: el });
      old = null;
    } else if (isNot(x)) {
      cb({ add: y });
      offset++;
    } else {
      cb({ patch: x, with: y, target: el });
      offset++;
    }
  }

  if (offset !== target.childNodes.length) {
    for (let k = target.childNodes.length; k > offset; k--) {
      cb({ rm: target.childNodes[k] });
    }
  }
}

export function isDiff(prev, next) {
  if (typeof prev !== typeof next) return true;
  if (isArray(prev)) {
    if (!isArray(next) || prev.length !== next.length) return true;

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

export const camelCase = value => value.replace(/-([a-z])/g, (_, $1) => $1.toUpperCase());
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
