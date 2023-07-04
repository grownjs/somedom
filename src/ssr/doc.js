import he from 'he';
import { selectAll, selectOne } from 'css-select';

import Fragment from '../lib/fragment.js';
import { dashCase } from '../lib/util.js';
import { markupAdapter } from './adapter.js';
import { CLOSE_TAGS, isNot } from '../lib/shared.js';
import { parse, parseDefaults } from './himalaya/index.js';

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
  insertAdjacentHTML() {
    throw new Error(`${this.tagName}.insertAdjacentHTML() not implemented`);
  }

  getElementsByClassName(name) {
    return selectAll(`.${name}`, this, { adapter: markupAdapter });
  }

  getElementById(id) {
    return selectOne(`#${id}`, this, { adapter: markupAdapter });
  }

  querySelectorAll(rule) {
    return selectAll(rule, this, { adapter: markupAdapter });
  }

  querySelector(rule) {
    return selectOne(rule, this, { adapter: markupAdapter });
  }

  cloneNode(children) {
    if (!children) {
      const target = document.createElement(this.tagName.toLowerCase());

      Object.entries(this.attributes).forEach(([key, val]) => {
        target.setAttribute(key, val);
      });
      return target;
    }

    const self = document.createElement('div');

    traverse(self, parse(this.outerHTML, parseDefaults));
    return self.childNodes[0];
  }

  contains() {
    throw new Error(`${this.tagName}.contains() not implemented`);
  }

  closest() {
    throw new Error(`${this.tagName}.closest() not implemented`);
  }
}

export function traverse(target, children) {
  children.forEach(node => {
    switch (node.type) {
      case 'element': {
        if (node.tagName === '!doctype') {
          target.appendChild(document.implementation.createDocumentType(...node.attributes.map(x => x.key)));
          break;
        }

        const el = document.createElement(node.tagName);

        node.attributes.forEach(attr => {
          el.setAttribute(attr.key, attr.value === null ? true : attr.value);
        });

        if (node.children) {
          traverse(el, node.children);
        }
        target.appendChild(el);
      } break;

      case 'comment':
        target.appendChild(document.createComment(node.content));
        break;

      case 'text':
        target.appendChild(document.createTextNode(node.content));
        break;

      default:
        throw new ReferenceError(`Unsupported nodeType=${node.type}`);
    }
  });
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

  walk(this, this.childNodes);
  return found;
}

export function bindHelpers(target) {
  return Object.assign(target, { withText, findText });
}

export function encodeText(value, opts = {}) {
  value = he.encode(value, { allowUnsafeSymbols: true });

  if (opts.unsafe !== true) {
    value = value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  if (opts.quotes !== false) {
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

export function createDocumentType(...args) {
  return { outerHTML: `<!DOCTYPE${args.length > 0 ? ` ${args.join(' ')}` : ''}>` };
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
    get textContent() {
      return self.childNodes.reduce((memo, cur) => memo
        // eslint-disable-next-line no-nested-ternary
        + (cur.nodeType === 1 ? cur.textContent : (cur.nodeType === 3 ? cur.nodeValue : '')), '');
    },
    set textContent(val) {
      self.childNodes = [createTextNode(val)];
    },
    get firstChild() {
      return self.childNodes[0];
    },
    get lastChild() {
      return self.childNodes[self.childNodes.length - 1];
    },
    set innerHTML(html) {
      self.childNodes = [];
      traverse(self, parse(html, parseDefaults));
    },
    get innerHTML() {
      return self.childNodes.map(node => {
        return node.nodeType === 8
          ? `<!--${node.nodeValue}-->`
          : node.outerHTML || encodeText(node.nodeValue, { quotes: false });
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

  if (['a', 'base', 'link', 'area'].includes(name)) {
    let _url;
    ['href', 'origin', 'protocol', 'username', 'password', 'host', 'hostname', 'port', 'pathname', 'search', 'hash'].forEach(key => {
      Object.defineProperty(self, key, {
        get: () => {
          if (!_url) _url = new URL(self.attributes.href, window.location);
          return _url[key];
        },
        set: v => {
          if (!_url) _url = new URL(self.attributes.href, window.location);
          _url[key] = v;
        },
      });
    });
  }

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

/* global globalThis */
const _global = typeof global === 'undefined' ? globalThis : global;

export function patchDocument() {
  _global.document = {
    body: createElement('body'),
    implementation: { createDocumentType },
    getElementsByClassName() {
      throw new Error('DOCUMENT.getElementsByClassName() not implemented');
    },
    getElementById() {
      throw new Error('DOCUMENT.getElementById() not implemented');
    },
    querySelectorAll() {
      throw new Error('DOCUMENT.querySelectorAll() not implemented');
    },
    querySelector() {
      throw new Error('DOCUMENT.querySelector() not implemented');
    },
    createElementNS,
    createElement,
    createTextNode,
    createComment,
    createDocumentFragment,
  };

  Object.defineProperty(_global.document, 'location', {
    get: () => _global.window.location,
    set: v => { _global.window.location = v; },
  });
}

export function patchWindow() {
  if (typeof Deno === 'undefined' && typeof Bun === 'undefined') _global.Event = Event;
  _global.window = {
    eventListeners: {},
    Event,
    HTMLElement,
    dispatchEvent,
    addEventListener,
    removeEventListener,
  };

  let _location = new URL('http://0.0.0.0');
  Object.defineProperty(_global.window, 'location', {
    get: () => _location,
    set: v => { _location = new URL(v); },
  });
}

export function dropDocument() {
  delete _global.document;
}

export function dropWindow() {
  delete _global.window;
}
