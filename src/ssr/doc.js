import { Fragment, CLOSE_TAGS } from '../lib/shared';

export function dispatch(type, params) {
  this.dispatchEvent({ type, ...params });
}

export function withText(value, key) {
  return this.findText(value)[key || 0];
}

export function findText(value) {
  const found = [];

  function walk(sub, nodes) {
    nodes.forEach(x => {
      if (x.childNodes) walk(x, x.childNodes);
      if (x.nodeValue && x.nodeValue.indexOf(value) !== -1) found.push(sub);
    });
  }

  walk(this, this.childNodes);

  return found;
}

export function encodeText(value) {
  return String(value)
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

export function createElement(name) {
  const el = {
    nodeType: 1,
    tagName: name.toUpperCase(),
    eventListeners: {},
    className: '',
    attributes: {},
    childNodes: [],
    dispatch,
    findText,
    withText,
    dispatchEvent,
    addEventListener,
    removeEventListener,
    classList: {
      add: (...value) => {
        const classes = el.className.trim().split(/\W/);

        el.className = classes.concat(value.filter(x => classes.indexOf(x) === -1)).join(' ');
      },
      remove: (...value) => {
        el.className = el.className.replace(new RegExp(`(\\b|^)\\s*${value.join('|')}\\s*(\\b|$)`), '').trim();
      },
      replace: (oldC, newC) => {
        el.className = el.className.replace(new RegExp(`(\\b|^)\\s*${oldC}\\s*(\\b|$)`), ` ${newC} `).trim();
      },
      item: nth => el.className.split(/\W/)[nth] || null,
      toggle: (value, force) => {
        if (force === true) el.classList.add(value);
        else if (force === false) el.classList.remove(value);
        else if (el.classList.contains(value)) el.classList.remove(value);
        else el.classList.add(value);
      },
      contains: value => el.className.split(/\W/).indexOf(value) !== -1,
    },
    get innerHTML() {
      return el.childNodes.map(node => node.outerHTML || node.nodeValue).join('');
    },
    get outerHTML() {
      const props = Object.keys(el.attributes).reduce((prev, cur) => {
        if (typeof el.attributes[cur] !== 'object') {
          prev.push(` ${cur}="${encodeText(el.attributes[cur])}"`);
        }
        return prev;
      }, []);

      if (el.className) {
        props.push(` class="${el.className}"`);
      }

      if (CLOSE_TAGS.indexOf(name) !== -1) {
        return `<${name}${props.join('')}/>`;
      }

      return `<${name}${props.join('')}>${el.innerHTML}</${name}>`;
    },
    replaceChild(n, o) {
      n.parentNode = el;

      const i = el.childNodes.indexOf(o);

      if (i !== -1) el.childNodes.splice(i, 1, n);
    },
    removeChild(n) {
      const i = el.childNodes.indexOf(n);

      if (i !== -1) el.childNodes.splice(i, 1);
    },
    insertBefore(n, o) {
      n.parentNode = el;

      const i = el.childNodes.indexOf(o);

      if (i !== -1) el.childNodes.splice(i, 0, n);
    },
    appendChild(n) {
      n.parentNode = el;
      el.childNodes.push(n);
    },
    setAttribute(k, v) {
      el.attributes[k] = v;
    },
    setAttributeNS(ns, k, v) {
      el.attributes[k] = v;
    },
    removeAttribute(k) {
      delete el.attributes[k];
    },
    removeAttributeNS(ns, k) {
      delete el.attributes[k];
    },
  };

  return el;
}

export function createDocumentFragment() {
  return new Fragment();
}

export function createElementNS(ns, name) {
  return {
    ...createElement(name),
    namespace: ns,
    isSvg: true,
  };
}

export function createTextNode(content) {
  return { nodeType: 3, nodeValue: String(content) };
}

export function patchDocument() {
  global.document = {
    body: createElement('body'),
    createElementNS,
    createElement,
    createTextNode,
    querySelector() {},
    createDocumentFragment,
  };
}

export function patchWindow() {
  global.window = {
    eventListeners: {},
    dispatchEvent,
    addEventListener,
    removeEventListener,
    DocumentFragment: Fragment,
  };
  global.DocumentFragment = Fragment;
}

export function dropDocument() {
  delete global.document;
}

export function dropWindow() {
  delete global.window;
  delete global.DocumentFragment;
}
