/* eslint-disable class-methods-use-this */

import { CLOSE_TAGS } from '../lib/shared';
import Fragment from '../lib/fragment';
import {
  tick, isNot, dashCase,
} from '../lib/util';

export class Event {
  constructor(type, params) {
    Object.assign(this, { type, ...params });
  }
}

export class Node {
  constructor(props) {
    Object.keys(props).forEach(key => {
      Object.defineProperty(this, key, Object.getOwnPropertyDescriptor(props, key));
    });
  }

  get nextSibling() {
    const offset = this.parentNode.childNodes.indexOf(this);
    return this.parentNode.childNodes[offset + 1] || null;
  }
}

export class Text extends Node {}
export class Comment extends Node {}
export class HTMLElement extends Node {
  querySelector() {
    throw new Error('Not implemented');
  }

  contains() {
    throw new Error('Not implemented');
  }
}

export function mount(node, el) {
  if (Fragment.valid(node)) {
    node.childNodes.forEach(sub => mount(sub, el));
  } else {
    Object.defineProperties(node, {
      parentNode: { configurable: true, value: el },
      isConnected: { configurable: true, value: true },
    });
  }
}

export function remove() {
  this.parentNode.removeChild(this);
}

export function replace(node) {
  if (this.parentNode) {
    this.parentNode.replaceChild(node, this);
  }
}

export function withText(value, key) {
  return this.findText(value)[key || 0];
}

export function findText(value) {
  const found = [];

  function walk(sub, nodes) {
    for (let i = 0; i < nodes.length; i += 1) {
      if (nodes[i].childNodes) walk(nodes[i], nodes[i].childNodes);
      if (nodes[i].nodeValue) {
        if (value instanceof RegExp && value.test(nodes[i].nodeValue)) found.push(sub);
        else if (nodes[i].nodeValue.indexOf(value) !== -1) found.push(sub);
      }
    }
  }

  // istanbul ignore next
  const _Event = typeof window !== 'undefined' ? window.Event : Event;

  walk(this, this.childNodes);

  found.forEach(node => {
    // istanbul ignore next
    if (!node.dispatch) {
      node.dispatch = (type, params) => {
        node.dispatchEvent(new _Event(type, params));
      };
    }
  });

  return found;
}

export function bindHelpers(target) {
  return Object.assign(target, { withText, findText });
}

export function encodeText(value, quotes) {
  value = String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  if (quotes !== false) {
    value = value.replace(/"/g, '&quot;');
  }
  return value;
}

export function dispatchEvent(e) {
  (this.eventListeners[e.type] || []).map(cb => cb({
    currentTarget: this,
    ...e,
  }));
}

export function addEventListener(name, callback) {
  (this.eventListeners[name] || (this.eventListeners[name] = [])).push(callback);
}

export function removeEventListener(name, callback) {
  if (this.eventListeners[name]) {
    this.eventListeners[name].splice(this.eventListeners[name].indexOf(callback), 1);
  }
}

export function createElementNode(name, props) {
  const self = new HTMLElement({
    ...props,
    eventListeners: {},
    className: '',
    childNodes: [],
    attributes: {},
    style: {},
    remove,
    dispatchEvent,
    addEventListener,
    removeEventListener,
    replaceWith: replace,
    classList: {
      add(...value) {
        const classes = self.className.trim().split(/\W/);

        self.className = classes.concat(value.filter(x => classes.indexOf(x) === -1)).join(' ');
      },
      remove(...value) {
        self.className = self.className.replace(new RegExp(`(\\b|^)\\s*${value.join('|')}\\s*(\\b|$)`), '').trim();
      },
      replace(oldC, newC) {
        self.className = self.className.replace(new RegExp(`(\\b|^)\\s*${oldC}\\s*(\\b|$)`), ` ${newC} `).trim();
      },
      item(nth) {
        return self.className.split(/[^\w-]/)[nth] || null;
      },
      toggle(value, force) {
        if (force === true) self.classList.add(value);
        else if (force === false) self.classList.remove(value);
        else if (self.classList.contains(value)) self.classList.remove(value);
        else self.classList.add(value);
      },
      contains: value => self.className.split(/\W/).indexOf(value) !== -1,
    },
    get firstChild() {
      return self.childNodes[0];
    },
    set innerHTML(value) {
      self.__html = value;
    },
    get innerHTML() {
      return self.__html || self.childNodes.map(node => {
        return node.nodeType === 8
          ? `<!--${node.nodeValue}-->`
          : node.outerHTML || encodeText(node.nodeValue, false);
      }).join('');
    },
    get outerHTML() {
      const _css = [];
      const _props = Object.keys(self.attributes).reduce((prev, cur) => {
        prev.push(` ${cur}="${encodeText(self.attributes[cur])}"`);
        return prev;
      }, []);

      if (self.className) {
        _props.push(` class="${self.className}"`);
      }

      Object.keys(self.style).forEach(k => {
        _css.push(`${dashCase(k)}: ${self.style[k]};`);
      });

      if (_css.length > 0) {
        _props.push(` style="${_css.join(' ')}"`);
      }

      if (CLOSE_TAGS.indexOf(name) !== -1) {
        return `<${name}${_props.join('')}>`;
      }

      return `<${name}${_props.join('')}>${self.innerHTML}</${name}>`;
    },
    dispatch(type, params) {
      return tick(() => self.dispatchEvent(new Event(type, params)));
    },
    replaceChild(n, o) {
      mount(n, self);

      self.childNodes.splice(self.childNodes.indexOf(o), 1, n);
    },
    removeChild(n) {
      self.childNodes = self.childNodes.reduce((prev, cur) => {
        if (cur !== n) prev.push(cur);
        return prev;
      }, []);
    },
    insertBefore(n, o) {
      mount(n, self);

      if (Fragment.valid(n)) {
        n.childNodes.forEach(sub => {
          self.insertBefore(sub, o);
        });
        n.childNodes = [];
      } else if (o === null) {
        self.appendChild(n);
      } else {
        const offset = self.childNodes.indexOf(o);

        if (offset === -1) {
          self.appendChild(n);
        } else {
          self.childNodes.splice(self.childNodes.indexOf(o), 0, n);
        }
      }
    },
    appendChild(n) {
      mount(n, self);

      if (Fragment.valid(n)) {
        n.childNodes.forEach(sub => {
          self.appendChild(sub);
        });
        n.childNodes = [];
      } else if (self.tagName === 'PRE') {
        self.childNodes.push(n);
      } else {
        self.childNodes.push(n);
      }
    },
    getAttribute(k) {
      return !isNot(self.attributes[k])
        ? self.attributes[k]
        : null;
    },
    setAttribute(k, v) {
      self.attributes[k] = v.toString();
    },
    setAttributeNS(ns, k, v) {
      self.attributes[k] = v.toString();
    },
    removeAttribute(k) {
      delete self.attributes[k];
    },
    removeAttributeNS(ns, k) {
      delete self.attributes[k];
    },
  });
  return self;
}

export function createDocumentFragment() {
  return new Fragment();
}

export function createElementNS(ns, name) {
  return createElementNode(name, {
    namespaceURI: ns,
  });
}

export function createElement(name) {
  return createElementNode(name, {
    tagName: name.toUpperCase(),
    nodeType: 1,
  });
}

export function createTextNode(content) {
  return new Text({
    remove,
    replaceWith: replace,
    nodeType: 3,
    nodeValue: String(content),
  });
}

export function createComment(content) {
  return new Comment({
    remove,
    replaceWith: replace,
    nodeType: 8,
    nodeValue: String(content),
  });
}

export function patchDocument() {
  global.document = {
    body: createElement('body'),
    querySelector() {
      throw new Error('Not implemented');
    },
    createElementNS,
    createElement,
    createTextNode,
    createComment,
    createDocumentFragment,
  };
}

export function patchWindow() {
  global.Event = Event;
  global.window = {
    eventListeners: {},
    HTMLElement,
    dispatchEvent,
    addEventListener,
    removeEventListener,
  };
}

export function dropDocument() {
  delete global.document;
}

export function dropWindow() {
  delete global.window;
}
