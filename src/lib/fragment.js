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

    this.childNodes.forEach(sub => doc.appendChild(sub));
    this.childNodes = [];
    return doc;
  }

  mount(target, node) {
    Object.defineProperties(this, {
      parentNode: { configurable: true, value: target },
      isConnected: { configurable: true, value: true },
    });

    if (target) {
      const doc = this.getDocumentFragment();

      if (node) {
        target.insertBefore(doc, node);
      } else {
        target.appendChild(doc);
      }
    }
  }

  static valid(value) {
    if (value instanceof Fragment) return true;
    return typeof value === 'object' && value.nodeType === 11;
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
