export default class Fragment {
  constructor(data, cb) {
    this.childNodes = (data && data.map(cb)) || [];
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
