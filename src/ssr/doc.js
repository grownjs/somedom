/* istanbul ignore file */

export const CLOSE_TAGS = [
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
];

export function withText(value) {
  const found = [];

  function walk(sub, nodes) {
    nodes.forEach(x => {
      if (!x.childNodes) {
        if (x.nodeValue && x.nodeValue.indexOf(value) !== -1) found.push(sub);
      } else walk(x, x.childNodes);
    });
  }

  walk(this, this.childNodes);

  return found;
}

export function encodeText(value) {
  return value
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
    tagName: name.toUpperCase(),
    eventListeners: {},
    className: '',
    attributes: {},
    childNodes: [],
    withText,
    dispatchEvent,
    addEventListener,
    removeEventListener,
    classList: {
      add: value => {
        el.className = el.className.split(/\s+/).concat(value).join(' ');
      },
      remove: value => {
        el.className = el.className.replace(new RegExp(`(\\b|^)\\s*${value}\\s*(\\b|$)`), '');
      },
    },
    get innerHTML() {
      return el.childNodes.map(node => node.outerHTML || node.nodeValue).join('');
    },
    get outerHTML() {
      const props = Object.keys(el.attributes).reduce((prev, cur) => {
        prev.push(` ${cur}="${encodeText(el.attributes[cur])}"`);
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
      const i = el.childNodes.indexOf(o);

      if (i !== -1) el.childNodes.splice(i, 1, n);
    },
    removeChild(n) {
      const i = el.childNodes.indexOf(n);

      if (i !== -1) el.childNodes.splice(i, 1);
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

export function createElementNS(ns, name) {
  return {
    ...createElement(name),
    namespace: ns,
    isSvg: true,
  };
}

export function createTextNode(value) {
  return { nodeValue: value };
}

export function patchDocument() {
  global.document = {
    body: createElement('body'),
    createElementNS,
    createElement,
    createTextNode,
    querySelector() {},
  };
}

export function patchWindow() {
  global.window = {
    eventListeners: {},
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
