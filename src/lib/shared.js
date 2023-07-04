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

export const IS_PROXY = Symbol('$$proxy');
export const IS_ARRAY = Symbol('$$array');

export const isArray = value => Array.isArray(value);
export const isString = value => typeof value === 'string';
export const isFunction = value => typeof value === 'function';
export const isNot = value => typeof value === 'undefined' || value === null;
export const isPlain = value => value !== null && Object.prototype.toString.call(value) === '[object Object]';
export const isObject = value => value !== null && (typeof value === 'function' || typeof value === 'object');
export const isScalar = value => isString(value) || typeof value === 'number' || typeof value === 'boolean';

export function isTuple(value) {
  if (!(isArray(value) && isEven(value.length))) return false;
  return toKeys(value).every(isString);
}

export function isNode(value) {
  if (isArray(value) && isFunction(value[0])) return true;
  if (!value || !(isArray(value) && isString(value[0]))) return false;
  return value[1] === null || (value.length >= 2 && (isPlain(value[1]) || isTuple(value[1])));
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

export function toProxy(values) {
  if (isNot(values)) values = [];
  if (Object.isFrozen(values) || IS_PROXY in values) return values;
  if (!isArray(values)) values = [].concat(...Object.entries(values));

  const keys = values.filter((_, i) => isEven(i));

  return new Proxy(values, {
    deleteProperty(target, prop) {
      const offset = keys.indexOf(prop);

      if (offset >= 0) {
        for (let i = 0; i < target.length; i += 2) {
          if (target[i] === prop) {
            keys.splice(offset, 1);
            target.splice(i, 2);
            break;
          }
        }
      }
      return true;
    },
    has(_, prop) {
      return prop === IS_PROXY || keys.includes(prop);
    },
    get(target, prop) {
      if (!keys.includes(prop)) {
        return Reflect.get(target, prop);
      }
      for (let i = 0; i < target.length; i += 2) {
        /* istanbul ignore else */
        if (target[i] === prop) return target[i + 1];
      }
    },
    set(target, prop, value) {
      for (let i = 0; i < target.length; i += 2) {
        if (target[i] === prop) {
          target[i + 1] = value;
          return true;
        }
      }
      target.push(prop, value);
      keys.push(prop);
      return true;
    },
  });
}

export function toKeys(value) {
  return value.filter((_, i) => isEven(i));
}

export function toFragment(vnode) {
  return vnode.slice(2);
}

export function toArray(value, callback) {
  if (!isArray(value) || IS_ARRAY in value) return value;
  if (isNode(value)) return callback(value);

  return value.reduce((memo, n) => {
    return memo.concat(isTuple(n) || isNode(n) ? [callback(n)] : toArray(n, callback));
  }, []);
}

export function toAttrs(node) {
  if (node.attributes && !node.getAttributeNames) {
    return [].concat(...Object.entries(node.attributes));
  }
  return node.getAttributeNames().reduce((memo, key) => {
    memo.push(key.replace('data-', '@'), node[key] || node.getAttribute(key));
    return memo;
  }, []);
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
