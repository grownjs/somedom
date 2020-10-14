export default class Fragment {
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
      this.childNodes[i] = node;
    }
  }

  appendChild(node) {
    this.childNodes.push(node);
  }

  mount(target) {
    this.childNodes.forEach(node => {
      if (!(node instanceof Fragment)) {
        target.appendChild(node);
      } else {
        node.mount(target);
      }
    });
  }

  get outerHTML() {
    return this.childNodes.map(node => node.outerHTML || node.nodeValue).join('');
  }
}
