import {
  isString,
} from './shared.js';

export default class Portal {
  constructor(target) {
    this.target = isString(target) ? document.querySelector(target) : target;
    this.childNodes = [];
    this.nodeType = 11;
  }

  appendChild(node) {
    this.childNodes.push(node);
  }

  mount() {
    if (!this.target) return;
    this.childNodes.forEach(node => {
      this.target.appendChild(node);
    });
  }

  unmount() {
    this.childNodes.forEach(node => {
      if (node.parentNode) {
        node.parentNode.removeChild(node);
      }
    });
    this.childNodes = [];
  }

  static valid(value) {
    return value instanceof Portal;
  }

  static from(render, children, target) {
    const portal = new Portal(target);
    children.forEach(vnode => {
      portal.appendChild(render(vnode));
    });
    return portal;
  }
}
