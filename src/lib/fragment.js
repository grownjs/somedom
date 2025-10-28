export default class Fragment {
  constructor() {
    this.childNodes = [];
    this.nodeType = 11;
  }

  appendChild(node) {
    if (Fragment.valid(node)) {
      node.childNodes.forEach(sub => {
        this.appendChild(sub);
      });
    } else {
      this.childNodes.push(node);
    }
  }

  mount(target, node) {
    while (this.childNodes.length > 0) {
      const next = this.childNodes.shift();

      if (node) {
        target.insertBefore(next, node);
      } else {
        target.appendChild(next);
      }
    }
  }

  static valid(value) {
    return value instanceof Fragment;
  }

  static from(render, value) {
    const target = new Fragment();
    value = value.filter(_ => _ !== null);
    target.vnode = value;
    value.forEach(vnode => {
      target.appendChild(render(vnode));
    });
    return target;
  }
}
