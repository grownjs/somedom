/* eslint-disable no-plusplus */

export const BEGIN = Symbol('BEGIN');
export const END = Symbol('END');

export default class Fragment {
  constructor() {
    this.childNodes = [];
    this.nodeType = 11;
    this.length = 0;
  }

  appendChild(node) {
    if (Fragment.valid(node)) {
      node.childNodes.forEach(sub => {
        this.appendChild(sub);
      });
    } else {
      this.childNodes.push(node);
      this.length += 1;
    }
  }

  getDocumentFragment() {
    const doc = document.createDocumentFragment();

    this.flush(doc);
    return doc;
  }

  upgrade(next) {
    const q = [];

    let c = this.begin.__length;
    let i = this.offset;
    while (c-- > 0) {
      q.push(this.root.childNodes[i++]);
    }

    this.begin.__length = next.length;
    next.childNodes.forEach(node => {
      this.root.insertBefore(node, this.end);
    });

    return Promise.all(q.map(node => node.remove()));
  }

  remove(wait) {
    wait = wait || (cb => cb());
    return Promise.resolve().then(() => wait(() => this.children.map(sub => sub && sub.remove())));
  }

  mount(target, node) {
    Object.defineProperty(this, 'parentNode', { configurable: true, value: target });

    const doc = this.getDocumentFragment();

    if (node) {
      target.insertBefore(doc, node);
    } else {
      target.appendChild(doc);
    }
  }

  flush(target) {
    this.begin = document.createTextNode('');
    this.end = document.createTextNode('');

    this.begin.__length = this.childNodes.length;
    this.begin.__mark = BEGIN;
    this.begin.__self = this;
    this.end.__mark = END;

    target.appendChild(this.begin);
    this.childNodes.forEach(sub => target.appendChild(sub));
    target.appendChild(this.end);
    this.childNodes = [];
  }

  get outerHTML() {
    return this.children.map(node => node.outerHTML || node.nodeValue).join('');
  }

  get children() {
    if (this.root) {
      const childNodes = [];
      const { offset } = this;

      for (let i = 0; i < this.length; i += 1) {
        childNodes.push(this.root.childNodes[i + offset]);
      }
      return childNodes;
    }
    return this.childNodes;
  }

  get offset() {
    const children = this.root.childNodes;

    let c = 0;
    for (let i = 0; i < children.length; i += 1) {
      if (children[i] === this.begin) {
        c = i + 1;
        break;
      }
    }
    return c;
  }

  get root() {
    let root = this;
    while (Fragment.valid(root)) root = root.parentNode;
    return root;
  }

  static valid(value) {
    if (value instanceof Fragment) return true;
    return typeof value === 'object' && value.begin && value.nodeType === 11;
  }

  static from(render, value) {
    const target = new Fragment();

    target.vnode = value;
    value.forEach(vnode => {
      target.appendChild(render(vnode));
    });
    return target;
  }
}
