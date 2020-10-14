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
    this.childNodes[this.childNodes.indexOf(target)] = node;
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
