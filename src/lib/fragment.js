export default class Fragment {
  constructor(identifier) {
    this.childNodes = [];
    this.nodeType = 11;
    this.name = identifier;
  }

  appendChild(node) {
    this.childNodes.push(node);
  }

  getNodeAt(nth) {
    return this.parentNode.childNodes[nth + this.offset + 1];
  }

  remove() {
    const offset = this.offset + 1;
    const target = this.root;

    return (async () => {
      for (let i = offset + this.length; i >= offset; i -= 1) {
        if (typeof target.childNodes[i].remove !== 'function') {
          target.removeChild(target.childNodes[i]);
        } else {
          await target.childNodes[i].remove(); // eslint-disable-line
        }
      }
    })();
  }

  mount(target, node) {
    this.anchor = document.createTextNode('');
    this.length = this.childNodes.length;
    this.parentNode = target;

    if (!(target instanceof Fragment)) {
      this.anchor._anchored = target._anchored = true;
    }

    const doc = document.createDocumentFragment();

    this.flush(doc);

    if (node) {
      target.insertBefore(doc, node);
      target.insertBefore(this.anchor, doc);
    } else {
      target.appendChild(this.anchor);
      target.appendChild(doc);
    }
  }

  flush(target) {
    this.childNodes.forEach(sub => {
      if (sub instanceof Fragment) {
        sub.flush(target);
      } else {
        target.appendChild(sub);
      }
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
    const target = new Fragment('T');

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
