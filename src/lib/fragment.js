export default class Fragment {
  constructor(data, cb) {
    this.childNodes = (data && data.map(cb)) || [];
    this.nodeType = 11;
  }

  appendChild(node) {
    this.childNodes.push(node);
  }

  replaceChild(node, target) {
    this.childNodes[this.childNodes.indexOf(target)] = node;
  }

  remove() {
    return Promise.all(this.childNodes.map(node => {
      return typeof node.remove === 'function' && node.remove();
    }));
  }

  mount(target) {
    this.parentNode = target;
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
