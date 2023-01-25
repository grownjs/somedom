export const RE_XML_SPLIT = /(>)(<)(\/*)/g;
export const RE_XML_CLOSE_END = /.+<\/\w[^>]*>$/;
export const RE_XML_CLOSE_BEGIN = /^<\/\w/;

export const SVG_NS = 'http://www.w3.org/2000/svg';

export const XLINK_NS = 'http://www.w3.org/1999/xlink';
export const ELEM_REGEX = /^([\w-]*|[.#]\w+)(#[\w-]+)?(\.[\w-][\w-.]*)*$/;

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

export const SKIP_METHODS = [
  'constructor',
  'instance',
  'children',
  'render',
  'state',
  'props',
];
