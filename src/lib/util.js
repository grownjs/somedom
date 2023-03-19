import {
  RE_XML_SPLIT,
  RE_XML_CLOSE_END,
  RE_XML_CLOSE_BEGIN,
  isNot, isBlock, isPlain, isEmpty, isNode, isArray, isTuple,
} from './shared';

import Fragment from './fragment';

export * from './shared';

export function flat(value) {
  return !isArray(value) ? value : value.reduce((memo, n) => memo.concat(isNode(n) || isTuple(n) ? [n] : flat(n)), []);
}

export function zip(nodes, prev, next, offset, cb, d = 0) {
  const c = Math.max(prev.length, next.length);

  let i = 0;
  let a = 0;
  let b = 0;
  for (; i < c; i++) {
    const el = nodes[offset];
    const x = flat(prev[a]);
    const y = flat(next[b]);

    if (isNot(x)) {
      cb({ add: y });
    } else if (isNot(y)) {
      if (isBlock(x)) {
        let k = x.length;
        while (k--) cb({ rm: nodes[offset++] });
      } else if (el) {
        cb({ rm: el });
        offset++;
      }
    } else if (isBlock(x) && isBlock(y)) {
      zip(nodes, x, y, offset, cb, d + 1);
      offset += Math.max(x.length, y.length) + 2;
    } else if (isBlock(y)) {
      zip(nodes, [x], y, offset, cb, d + 1);
      offset += y.length + 2;
    } else if (el) {
      cb({ patch: x, with: y, target: el });
      offset++;
    } else {
      cb({ add: y });
      offset++;
    }
    a++;
    b++;
  }

  if (offset !== nodes.length) {
    for (let k = offset; k < nodes.length; k++) {
      cb({ rm: nodes[k] });
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
