export const SVG_NS = 'http://www.w3.org/2000/svg';

export const XLINK_NS = 'http://www.w3.org/1999/xlink';
export const ELEM_REGEX = /^(\w*|[.#]\w+)(#[\w-]+)?([\w.-]+)?$/;

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

export function assert(vnode) {
  throw new Error(`Invalid vnode, given '${vnode}'`);
}

export class Fragment {
  constructor(data, cb) {
    this.childNodes = [];

    if (data) {
      data.forEach(node => {
        this.appendChild(cb(node));
      });
    }
  }

  replaceChild(node, target) {
    const i = this.childNodes.indexOf(target);

    if (i !== -1) {
      node.parentNode = this;
      this.childNodes[i] = node;
    }
  }

  appendChild(node) {
    this.childNodes.push(node);
  }

  get outerHTML() {
    return this.childNodes.map(node => node.outerHTML || node.nodeValue).join('');
  }
}
