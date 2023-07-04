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

  mount(target, node) {
    while (this.childNodes.length > 0) {
      if (node) {
        target.insertBefore(this.childNodes.shift(), node);
      } else {
        target.appendChild(this.childNodes.shift());
      }
    }
  }

  static valid(value) {
    if (value instanceof Fragment) return true;
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
