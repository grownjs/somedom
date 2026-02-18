export const RE_TAG_NAME = /^[0-9A-Za-z-]+$/;
export const RE_XML_SPLIT = /(>)(<)(\/*)/g;
export const RE_XML_CLOSE_END = /.+<\/\w[^>]*>$/;
export const RE_XML_CLOSE_BEGIN = /^<\/\w/;

export const XLINK_PREFIX = /^xlink:?/;
export const XLINK_NS = 'http://www.w3.org/1999/xlink';

export const EE_SUPPORTED = ['oncreate', 'onupdate', 'onreplace', 'ondestroy'];

export const CLOSE_TAGS = [
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
];

export const isArray = value => Array.isArray(value);
export const isString = value => typeof value === 'string';
export const isFunction = value => typeof value === 'function';
export const isNot = value => typeof value === 'undefined' || value === null;
export const isPlain = value => value !== null && Object.prototype.toString.call(value) === '[object Object]';
export const isObject = value => value !== null && (typeof value === 'function' || typeof value === 'object');
export const isScalar = value => isString(value) || typeof value === 'number' || typeof value === 'boolean';

export function isTag(value) {
  return RE_TAG_NAME.test(value);
}

export function isNode(value) {
  if (isArray(value) && isFunction(value[0])) return true;
  if (!value || !(isArray(value) && isTag(value[0]))) return false;
  if (isPlain(value[1]) && value.length >= 2) return true;
  return false;
}

export function isEmpty(value) {
  if (value === null) return true;
  if (isFunction(value)) return false;
  if (isArray(value)) return value.length === 0;
  if (isPlain(value)) return Object.keys(value).length === 0;

  return isNot(value) || value === false;
}

export const isBlock = value => isArray(value) && !isNode(value);
export const isEven = value => value % 2 === 0;

export function getKey(vnode) {
  if (isNode(vnode) && isPlain(vnode[1])) {
    return vnode[1].key;
  }
  return undefined;
}

export function getKeyFromNode(node) {
  if (node.nodeType === 1) {
    return node.getAttribute('data-key') || undefined;
  }
  return undefined;
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

export function toFragment(vnode) {
  return vnode.slice(2);
}

export function toArray(value) {
  if (isNode(value)) return value;
  if (!isArray(value)) return isEmpty(value) ? [] : [value];
  return value.reduce((memo, n) => memo.concat(isNode(n) ? [n] : toArray(n)), []);
}

export function toAttrs(node) {
  if (node.attributes && !node.getAttributeNames) {
    return node.attributes;
  }
  return node.getAttributeNames().reduce((memo, key) => {
    memo[key.replace('data-', '@')] = node[key] || node.getAttribute(key);
    return memo;
  }, {});
}

export function toNodes(node, children) {
  if (isNot(node)) return;
  if (isArray(node)) return node.map(x => toNodes(x, children));

  if (typeof NodeList !== 'undefined' && node instanceof NodeList) return toNodes(node.values(), children);

  if (node.nodeType === 3) return node.nodeValue;
  if (node.nodeType === 1) {
    const nodes = [];

    if (children) {
      node.childNodes.forEach(x => {
        nodes.push(toNodes(x, children));
      });
    }

    return [node.tagName.toLowerCase(), toAttrs(node), nodes];
  }

  if (node.childNodes) return node.childNodes.map(x => toNodes(x, children));

  return toNodes([...node], children);
}
