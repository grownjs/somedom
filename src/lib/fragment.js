export default class Fragment {
  constructor() {
    this.childNodes = [];
    this.nodeType = 11;
    this.length = 0;
  }

  appendChild(node) {
    if (node instanceof Fragment) {
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
    if (!this.childNodes.length) {
      this.anchor = document.createTextNode('');
      this.childNodes.push(this.anchor);
      this.length = 1;
    }

    this.anchor = this.childNodes[0];
    this.anchor._anchored = this;
    this.childNodes.forEach(sub => {
      target.appendChild(sub);
    });
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
      if (children[i] === this.anchor) {
        c = i;
        break;
      }
    }
    return c;
  }

  get root() {
    let root = this;
    while (root instanceof Fragment) root = root.parentNode;
    return root;
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
