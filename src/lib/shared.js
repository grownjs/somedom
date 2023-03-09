export const RE_XML_SPLIT = /(>)(<)(\/*)/g;
export const RE_XML_CLOSE_END = /.+<\/\w[^>]*>$/;
export const RE_XML_CLOSE_BEGIN = /^<\/\w/;

export const SVG_NS = 'http://www.w3.org/2000/svg';

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

export const isArray = value => Array.isArray(value);
export const isString = value => typeof value === 'string';
export const isFunction = value => typeof value === 'function';
export const isNot = value => typeof value === 'undefined' || value === null;
export const isPlain = value => value !== null && Object.prototype.toString.call(value) === '[object Object]';
export const isObject = value => value !== null && (typeof value === 'function' || typeof value === 'object');
export const isScalar = value => isString(value) || typeof value === 'number' || typeof value === 'boolean';

export function isNode(value) {
  if (!isArray(value)) return false;
  if (typeof value[0] === 'function') return true;
  if (value[1] === null || isPlain(value[1])) return true;
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
