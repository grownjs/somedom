export default class Fragment {
  constructor() {
    this.childNodes = [];
    this.nodeType = 11;
  }

  appendChild(node) {
    if (node instanceof Fragment) {
      node.childNodes.forEach(sub => {
        this.appendChild(sub);
      });
    } else {
      this.childNodes.push(node);
    }
  }

  getNodeAt(nth) {
    return this.parentNode.childNodes[nth + this.offset + 1];
  }

  remove() {
    const offset = this.offset + 1;
    const target = this.root;

    return (async () => {
      for (let i = offset + this.length; i >= offset; i -= 1) {
        if (target.childNodes[i]) await target.childNodes[i].remove(); // eslint-disable-line
      }
    })();
  }

  replace(target, i) {
    const doc = document.createDocumentFragment();

    this.flush(doc);
    target.replaceChild(doc, target.childNodes[i]);
  }

  mount(target, node) {
    let offset = -1;
    let anchor;
    for (let i = 0; i < target.childNodes.length; i += 1) {
      if (target.childNodes[i]._anchored) {
        anchor = target.childNodes[i];
        offset = i;
        break;
      }
    }

    if (offset >= 0) {
      for (let i = 0; i < anchor._anchored.length; i += 1) {
        if (target.childNodes[i + offset + 1]) target.removeChild(target.childNodes[i + offset + 1]);
      }
    }

    this.anchor = anchor || document.createTextNode('');
    this.length = this.childNodes.length;
    this.parentNode = target;

    if (!(target instanceof Fragment)) {
      this.anchor._anchored = target._anchored = this;
    }

    const doc = document.createDocumentFragment();

    this.flush(doc);

    if (node) {
      if (!anchor) target.insertBefore(this.anchor, node);
      target.insertBefore(doc, node);
    } else {
      if (!anchor) target.appendChild(this.anchor);
      target.appendChild(doc);
    }
  }

  flush(target) {
    this.childNodes.forEach(sub => {
      target.appendChild(sub);
    });
    this.childNodes = [];
  }

  get outerHTML() {
    if (this.childNodes.length) {
      return this.childNodes.map(node => node.outerHTML || node.nodeValue).join('');
    }

    const target = this.root || this.parentNode;

    return target instanceof Fragment
      ? target.outerHTML
      : target.innerHTML;
  }

  get offset() {
    let offset = -1;
    for (let i = 0; i < this.parentNode.childNodes.length; i += 1) {
      if (this.parentNode.childNodes[i] === this.anchor) {
        offset = i;
        break;
      }
    }
    return offset;
  }

  get root() {
    let root = this;
    while (root instanceof Fragment) root = root.parentNode;
    return root;
  }

  static from(value, cb) {
    const target = new Fragment();

    value.forEach(vnode => {
      if (vnode instanceof Fragment) {
        vnode.mount(target);
      } else {
        target.appendChild(cb(vnode));
      }
    });

    return target;
  }
}
