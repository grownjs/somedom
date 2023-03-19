export const RE_NUMBER = /^\d+$/;
export const RE_XML_SPLIT = /(>)(<)(\/*)/g;
export const RE_XML_CLOSE_END = /.+<\/\w[^>]*>$/;
export const RE_XML_CLOSE_BEGIN = /^<\/\w/;

export const XLINK_PREFIX = /^xlink:?/;
export const XLINK_NS = 'http://www.w3.org/1999/xlink';

export const EE_SUPPORTED = ['oncreate', 'onupdate', 'ondestroy'];

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

export function toProxy(values) {
  if (!isArray(values)) values = [];
  if (IS_PROXY in values) return values;

  Object.defineProperty(values, IS_PROXY, { value: true });

  return new Proxy(values, {
    get(target, prop) {
      if (prop === Symbol.for('nodejs.util.inspect.custom')) return target;
      if (prop === Symbol.isConcatSpreadable) return target;
      if (prop === Symbol.toStringTag) return target;
      if (prop === Symbol.iterator) return target[Symbol.iterator].bind(target);
      if (prop === 'filter') return target.filter.bind(target);
      if (prop === 'length') return target.length;
      if (RE_NUMBER.test(prop)) return target[prop];

      for (let i = 0; i < target.length; i += 2) {
        /* istanbul ignore else */
        if (target[i] === prop) return target[i + 1];
      }
    },
    set(target, prop, value) {
      if (RE_NUMBER.test(prop)) {
        target[prop] = value;
        return true;
      }

      for (let i = 0; i < target.length; i += 2) {
        if (target[i] === prop) {
          target[i + 1] = value;
          return true;
        }
      }

      target.push(prop, value);
      return true;
    },
  });
}

export function toProps(value) {
  return Object.entries(value).reduce((memo, [k, v]) => {
    memo.push(k, v);
    return memo;
  }, []);
}

export function toKeys(value) {
  return value.filter((_, i) => isEven(i));
}

export function toFragment(vnode) {
  return vnode.slice(2);
}
