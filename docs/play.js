(function () {
  'use strict';

  const RE_NUMBER = /^\d+$/;
  const RE_XML_SPLIT = /(>)(<)(\/*)/g;
  const RE_XML_CLOSE_END = /.+<\/\w[^>]*>$/;
  const RE_XML_CLOSE_BEGIN = /^<\/\w/;

  const XLINK_PREFIX = /^xlink:?/;
  const XLINK_NS = 'http://www.w3.org/1999/xlink';

  const EE_SUPPORTED = ['oncreate', 'onupdate', 'ondestroy'];

  const IS_PROXY = Symbol('$$proxy');

  const isArray = value => Array.isArray(value);
  const isString = value => typeof value === 'string';
  const isFunction = value => typeof value === 'function';
  const isNot = value => typeof value === 'undefined' || value === null;
  const isPlain = value => value !== null && Object.prototype.toString.call(value) === '[object Object]';
  const isObject = value => value !== null && (typeof value === 'function' || typeof value === 'object');
  const isScalar = value => isString(value) || typeof value === 'number' || typeof value === 'boolean';

  function isTuple(value) {
    if (!(isArray(value) && isEven(value.length))) return false;
    return toKeys(value).every(isString);
  }

  function isNode(value) {
    if (isArray(value) && isFunction(value[0])) return true;
    if (!value || !(isArray(value) && isString(value[0]))) return false;
    return value[1] === null || (value.length >= 2 && (isPlain(value[1]) || isTuple(value[1])));
  }

  function isEmpty(value) {
    if (value === null) return true;
    if (isFunction(value)) return false;
    if (isArray(value)) return value.length === 0;
    if (isPlain(value)) return Object.keys(value).length === 0;

    return isNot(value) || value === false;
  }

  const isBlock = value => isArray(value) && !isNode(value);
  const isEven = value => value % 2 === 0;

  function toProxy(values) {
    if (!isArray(values)) values = [];
    if (IS_PROXY in values) return values;

    Object.defineProperty(values, IS_PROXY, { value: true });

    return new Proxy(values, {
      get(target, prop) {
        if (prop === Symbol.for('nodejs.util.inspect.custom')) return target;
        if (prop === Symbol.isConcatSpreadable) return target;
        if (prop === Symbol.toStringTag) return target;
        if (prop === Symbol.iterator) return target[Symbol.iterator].bind(target);
        if (prop === 'filter') return target.filter.bind(target);
        if (prop === 'length') return target.length;
        if (RE_NUMBER.test(prop)) return target[prop];

        for (let i = 0; i < target.length; i += 2) {
          /* istanbul ignore else */
          if (target[i] === prop) return target[i + 1];
        }
      },
      set(target, prop, value) {
        if (RE_NUMBER.test(prop)) {
          target[prop] = value;
          return true;
        }

        for (let i = 0; i < target.length; i += 2) {
          if (target[i] === prop) {
            target[i + 1] = value;
            return true;
          }
        }

        target.push(prop, value);
        return true;
      },
    });
  }

  function toProps(value) {
    return Object.entries(value).reduce((memo, [k, v]) => {
      memo.push(k, v);
      return memo;
    }, []);
  }

  function toKeys(value) {
    return value.filter((_, i) => isEven(i));
  }

  function toFragment(vnode) {
    return vnode.slice(2);
  }

  class Fragment {
    constructor() {
      this.childNodes = [];
      this.nodeType = 11;
      this.length = 0;
    }

    appendChild(node) {
      if (Fragment.valid(node)) {
        node.childNodes.forEach(sub => {
          this.appendChild(sub);
        });
      } else {
        this.childNodes.push(node);
        this.length += 1;
      }
    }

    getDocumentFragment() {
      const doc = document.createDocumentFragment();

      this.childNodes.forEach(sub => doc.appendChild(sub));
      this.childNodes = [];
      return doc;
    }

    mount(target, node) {
      Object.defineProperties(this, {
        parentNode: { configurable: true, value: target },
        isConnected: { configurable: true, value: true },
      });

      const doc = this.getDocumentFragment();

      if (node) {
        target.insertBefore(doc, node);
      } else {
        target.appendChild(doc);
      }
    }

    static valid(value) {
      if (value instanceof Fragment) return true;
    }

    static from(render, value) {
      const target = new Fragment();

      target.vnode = value;
      value.forEach(vnode => {
        target.appendChild(render(vnode));
      });
      return target;
    }
  }

  function flat(value) {
    return !isArray(value) ? value : value.reduce((memo, n) => memo.concat(isNode(n) || isTuple(n) ? [n] : flat(n)), []);
  }

  function zip(nodes, prev, next, offset, cb, d = 0) {
    const c = Math.max(prev.length, next.length);

    let i = 0;
    let a = 0;
    let b = 0;
    for (; i < c; i++) {
      const el = nodes[offset];
      const x = flat(prev[a]);
      const y = flat(next[b]);

      if (isNot(x)) {
        cb({ add: y });
      } else if (isNot(y)) {
        if (isBlock(x)) {
          let k = x.length;
          while (k--) cb({ rm: nodes[offset++] });
        } else if (el) {
          cb({ rm: el });
          offset++;
        }
      } else if (isBlock(x) && isBlock(y)) {
        zip(nodes, x, y, offset, cb, d + 1);
        offset += Math.max(x.length, y.length) + 2;
      } else if (isBlock(y)) {
        zip(nodes, [x], y, offset, cb, d + 1);
        offset += y.length + 2;
      } else if (el) {
        cb({ patch: x, with: y, target: el });
        offset++;
      } else {
        cb({ add: y });
        offset++;
      }
      a++;
      b++;
    }

    if (offset !== nodes.length) {
      for (let k = offset; k < nodes.length; k++) {
        cb({ rm: nodes[k] });
      }
    }
  }

  function isDiff(prev, next) {
    if (typeof prev !== typeof next) return true;
    if (isArray(prev)) {
      if (!isArray(next) || prev.length !== next.length) return true;

      for (let i = 0; i < next.length; i += 1) {
        if (isDiff(prev[i], next[i])) return true;
      }
    } else if (isPlain(prev) && isPlain(next)) {
      const a = Object.keys(prev).sort();
      const b = Object.keys(next).sort();

      if (isDiff(a, b)) return true;

      for (let i = 0; i < a.length; i += 1) {
        if (isDiff(prev[a[i]], next[b[i]])) return true;
      }
    } else return prev !== next;
  }

  const camelCase = value => value.replace(/-([a-z])/g, (_, $1) => $1.toUpperCase());
  const dashCase = value => value.replace(/[A-Z]/g, '-$&').toLowerCase();
  const filter = (value, cb) => value.filter(cb || (x => !isEmpty(x)));

  function format(markup) {
    let formatted = '';
    let pad = 0;

    markup = markup.replace(RE_XML_SPLIT, '$1\n$2$3');
    markup.split('\n').forEach(line => {
      let indent = 0;
      if (RE_XML_CLOSE_END.test(line)) {
        indent = 0;
      } else if (RE_XML_CLOSE_BEGIN.test(line)) {
        if (pad !== 0) {
          pad -= 1;
        }
      } else {
        indent = 1;
      }

      const padding = Array.from({ length: pad + 1 }).join('  ');

      formatted += `${padding + line}\n`;
      pad += indent;
    });

    return formatted.trim();
  }

  function trim(value) {
    const matches = value.match(/\n( )*/);
    const spaces = matches[0].substr(0, matches[0].length - 1);
    const depth = spaces.split('').length;

    return value.replace(new RegExp(`^ {${depth}}`, 'mg'), '').trim();
  }

  const apply = (cb, length, options = {}) => (...args) => length === args.length && cb(...args, options);
  const raf = cb => ((typeof window !== 'undefined' && window.requestAnimationFrame) || setTimeout)(cb);
  const tick = cb => Promise.resolve().then(cb).then(() => new Promise(done => raf(done)));
  const remove = (target, node) => target && target.removeChild(node);

  const detach = (target, node) => {
    if (node) {
      if (Fragment.valid(node)) {
        node.mount(target.parentNode, target);
      } else {
        target.parentNode.insertBefore(node, target);
      }
    }
    remove(target.parentNode, target);
  };

  function assignProps(target, attrs, svg, cb) {
    for (let i = 0; i < attrs.length; i += 2) {
      const prop = attrs[i];
      const val = attrs[i + 1];

      if (prop === 'key') continue;
      if (prop === 'ref') {
        target.oncreate = el => {
          val.current = el;
        };
      } else if (prop === '@html') {
        target.innerHTML = val;
      } else if (prop.indexOf('class:') === 0) {
        if (!val) {
          target.classList.remove(prop.substr(6));
        } else {
          target.classList.add(prop.substr(6));
        }
      } else if (prop.indexOf('style:') === 0) {
        target.style[camelCase(prop.substr(6))] = val;
      } else {
        const name = prop.replace('@', 'data-').replace(XLINK_PREFIX, '');

        // eslint-disable-next-line no-nested-ternary
        let value = val !== true ? val : (name.includes('-') ? true : name);
        if (isObject(value)) {
          value = (isFunction(cb) && cb(target, name, value)) || value;
          value = value !== target ? value : null;
          value = isArray(value)
            ? value.join('')
            : value;
        }

        const removed = isEmpty(value);

        if (svg && prop !== name) {
          if (removed) target.removeAttributeNS(XLINK_NS, name);
          else target.setAttributeNS(XLINK_NS, name, value);
          continue;
        }

        if (removed) target.removeAttribute(name);
        else if (isScalar(value)) target.setAttribute(name, value);
      }
    }
  }

  function updateProps(target, prev, next, svg, cb) {
    const [old, keys] = [prev, next].map(toKeys);
    const set = prev.concat(next);
    const data = new Map();
    const props = [];

    for (let i = 0; i < set.length; i += 2) {
      const k = set[i];
      const v = set[i + 1];

      /* istanbul ignore else */
      if (old.includes(k)) {
        if (!data.has(k)) data.set(k, v);
        if (!keys.includes(k)) props.push(k, null);
        else if (isDiff(data.get(k), v)) props.push(k, v);
      } else if (isDiff(data.get(k), v)) props.push(k, v);
    }

    if (props.length > 0) {
      assignProps(target, props, svg, cb);
      return true;
    }
  }

  function destroyElement(target, wait = cb => cb()) {
    const rm = () => target && target.remove();

    return wait === false ? rm() : Promise.resolve().then(() => wait(rm));
  }

  function replaceElement(target, next, svg, cb) {
    const newNode = createElement(next, svg, cb);

    if (Fragment.valid(newNode)) {
      detach(target, newNode);
    } else {
      target.replaceWith(newNode);
    }
    return newNode;
  }

  function insertElement(target, next, svg, cb) {
    const newNode = createElement(next, svg, cb);

    if (Fragment.valid(newNode)) {
      newNode.mount(target);
    } else {
      target.appendChild(newNode);
    }
    return newNode;
  }

  function createElement(vnode, svg, cb) {
    if (isNot(vnode)) throw new Error(`Invalid vnode, given '${vnode}'`);
    if (!isNode(vnode)) {
      if (isArray(vnode)) {
        return Fragment.from(v => createElement(v, svg, cb), vnode);
      }
      return (isScalar(vnode) && document.createTextNode(String(vnode))) || vnode;
    }

    if (isPlain(vnode[1])) {
      vnode[1] = toProps(vnode[1]);
    }

    while (vnode && isFunction(vnode[0])) {
      vnode = vnode[0](toProxy(vnode[1]), toFragment(vnode));
    }

    if (!isArray(vnode)) {
      return vnode;
    }

    if (cb && cb.tags && cb.tags[vnode[0]]) {
      return createElement(cb.tags[vnode[0]](toProxy(vnode[1]), toFragment(vnode), cb), svg, cb);
    }

    if (!isNode(vnode)) {
      return Fragment.from(v => createElement(v, svg, cb), vnode);
    }

    const isSvg = svg || vnode[0].indexOf('svg') === 0;
    const [tag, props, ...children] = vnode;

    let el = isSvg
      ? document.createElementNS('http://www.w3.org/2000/svg', tag)
      : document.createElement(tag);

    if (isFunction(cb)) {
      el = cb(el, tag, props, children) || el;
    }

    if (isFunction(el)) return createElement(el(), isSvg, cb);
    if (!isEmpty(props)) assignProps(el, props, isSvg, cb);
    if (isFunction(el.oncreate)) el.oncreate(el);
    if (isFunction(el.enter)) el.enter();

    el.remove = () => Promise.resolve()
      .then(() => isFunction(el.ondestroy) && el.ondestroy(el))
      .then(() => isFunction(el.teardown) && el.teardown())
      .then(() => isFunction(el.exit) && el.exit())
      .then(() => detach(el));

    children.forEach(sub => {
      mountElement(el, sub, isSvg, cb);
    });
    return el;
  }

  function mountElement(target, view, svg, cb) {
    if (isFunction(view)) {
      cb = view;
      view = target;
      target = undefined;
    }

    if (isFunction(svg)) {
      cb = svg;
      svg = null;
    }

    if (isNot(view)) {
      view = target;
      target = undefined;
    }

    if (!target) {
      target = document.body;
    }

    if (typeof target === 'string') {
      target = document.querySelector(target);
    }

    if (isArray(view) && !isNode(view)) {
      view.forEach(node => {
        mountElement(target, node, svg, cb);
      });
    } else if (!isNot(view)) {
      target = insertElement(target, view, svg, cb);
    }
    return target;
  }

  async function upgradeNode(target, prev, next, svg, cb) {
    if (!isNode(prev) || prev[0] !== next[0] || target.nodeType !== 1) {
      return replaceElement(target, next, svg, cb);
    }

    if (updateProps(target, prev[1] || [], next[1] || [], svg, cb)) {
      if (isFunction(target.onupdate)) await target.onupdate(target);
      if (isFunction(target.update)) await target.update();
    }

    return next[1] && toKeys(next[1]).includes('@html') ? target : updateElement(target, toFragment(prev), toFragment(next), svg, cb);
  }

  async function upgradeElements(target, prev, next, svg, cb, i) {
    const stack = [];
    const set = target.childNodes;
    const push = v => stack.push(v);

    if (!isBlock(next)) next = [next];

    zip(set, prev, next, i || 0, push);

    for (const task of stack) {
      if (task.rm) await destroyElement(task.rm);
      if (!isNot(task.add)) insertElement(target, task.add, svg, cb);
      if (!isNot(task.patch)) await patchNode(task.target, task.patch, task.with, svg, cb);
    }
  }

  async function updateElement(target, prev, next, svg, cb, i) {
    if (!prev || (isNode(prev) && isNode(next))) {
      return upgradeNode(target, prev, next, svg, cb);
    }

    if (isNode(prev)) {
      if (next.length === 1) next = next[0];
      return updateElement(target, [prev], next, svg, cb);
    }

    if (isNode(next)) {
      return upgradeNode(target, prev, next, svg, cb);
    }

    await upgradeElements(target, prev, next, svg, cb, i);
    return target;
  }

  async function patchNode(target, prev, next, svg, cb) {
    if (isFunction(next[0]) || (target.nodeType === 1 && target.tagName.toLowerCase() !== next[0])) {
      return replaceElement(target, next, svg, cb);
    }

    if (isDiff(prev, next)) {
      if (target.nodeType === 3) {
        if (isNode(next)) {
          target = await upgradeNode(target, prev, next, svg, cb);
        } else {
          target.nodeValue = String(next);
        }
      } else {
        target = await upgradeNode(target, prev, next, svg, cb);
      }
    }
    return target;
  }

  function values(attrs, cb) {
    if (isNot(attrs)) return [];
    if (!isObject(attrs)) return attrs;
    if (isArray(attrs)) return filter(attrs);

    return filter(Object.keys(attrs).reduce((prev, cur) => {
      if (!isNot(attrs[cur])) prev.push(cb(attrs[cur], cur));

      return prev;
    }, []));
  }

  function styles(props) {
    return values(props, (v, k) => `${dashCase(k)}: ${v}`);
  }

  function classes(props) {
    return values(props, (v, k) => (v ? k : undefined));
  }

  function datasets(el, name, props) {
    if (isArray(props)) {
      el.setAttribute(`data-${name}`, JSON.stringify(props));
    } else if (!isFunction(props)) {
      Object.keys(props).forEach(key => {
        const value = !isScalar(props[key])
          ? JSON.stringify(props[key])
          : props[key];

        el.setAttribute(`${name !== 'data' ? 'data-' : ''}${name}-${key}`, value);
      });
    }
  }

  function nextProps(el, names) {
    return () => new Promise(resolve => {
      let t;
      function onEnd() {
        el.removeEventListener('animationend', onEnd);

        names.map(x => el.classList.remove(x));

        clearTimeout(t);
        resolve();
      }

      t = setTimeout(onEnd, 500);

      el.addEventListener('animationend', onEnd);

      raf(() => { names.map(x => el.classList.add(x)); });
    });
  }

  function invokeProps(el, name, value, helpers) {
    if (isObject(helpers)) {
      if (isFunction(helpers)) return helpers(value, name, el);
      if (isFunction(helpers[name])) return helpers[name](value, name, el);
    }

    if (isObject(value)) datasets(el, name, value);
  }

  const applyStyles = value => styles(value).join('; ');
  const applyClasses = value => classes(value).join(' ');
  const applyAnimations = (value, name, el) => { el[name] = nextProps(el, classes(value)); };

  function eventListener(e) {
    return e.currentTarget.events[e.type](e);
  }

  function invokeEvent(e, name, value, globals) {
    let skip;
    if (isObject(globals)) {
      if (isFunction(globals)) {
        skip = globals(name, e) === false;
      } else if (isFunction(globals[name])) {
        skip = globals[name](e) === false;
      }
    }

    if (!skip) value(e);
  }

  function addEvents(el, name, value, globals) {
    if (isFunction(value)) {
      el.events = el.events || {};

      if (!el.teardown) {
        el.teardown = () => {
          Object.keys(el.events).forEach(x => {
            el.removeEventListener(x, eventListener);
            el.events[x] = [];
          });
        };
      }

      if (name.substr(0, 2) === 'on' && EE_SUPPORTED.indexOf(name) === -1) {
        const type = name.substr(2);

        if (!el.events[type]) el.addEventListener(type, eventListener, false);

        el.events[type] = e => invokeEvent(e, name, value, globals);
      } else {
        (EE_SUPPORTED.indexOf(name) > -1 ? el : el.events)[name] = value;
      }
    }
  }

  const h = (tag = 'div', attrs = null, ...children) => {
    if (isScalar(attrs)) return [tag, null, [attrs].concat(children).filter(x => !isNot(x))];
    if (isArray(attrs) && !children.length) return [tag, null, attrs];
    return [tag, attrs || null, children];
  };

  const pre = (vnode, svg, cb = createElement) => {
    return cb(['pre', ['class', 'highlight'], format(cb(vnode, svg).outerHTML)], svg);
  };

  const bind = (tag, ...hooks) => {
    const cbs = filter(hooks, isFunction);

    const mix = (...args) => {
      return cbs.reduce((prev, cb) => cb(...args) || prev, undefined);
    };

    const cb = (...args) => (args.length <= 2 ? tag(args[0], args[1], mix) : mix(...args));

    cb.tags = mix.tags = Object.assign({},
      ...filter(hooks, x => isArray(x) || isPlain(x))
        .reduce((memo, cur) => memo.concat(cur), []).filter(isPlain));

    return cb;
  };

  const listeners = opts => apply(addEvents, 3, opts);
  const attributes = opts => apply(invokeProps, 3, opts);

  var somedom = /*#__PURE__*/Object.freeze({
    __proto__: null,
    h: h,
    pre: pre,
    bind: bind,
    listeners: listeners,
    attributes: attributes,
    raf: raf,
    tick: tick,
    format: format,
    proxy: toProxy,
    mount: mountElement,
    patch: updateElement,
    render: createElement,
    unmount: destroyElement,
    styles: applyStyles,
    classes: applyClasses,
    animation: applyAnimations
  });

  function summarize(script) {
    const { innerHTML, parentNode } = script;

    const code = innerHTML
      .replace(/( +)appendChild\(([^;]*?)\);?/gm, '$1$2')
      .replace(/test\(\s*\([^=()]*\)\s*=>\s*\{/, '')
      .replace(/\}\)\s*;$/, '');

    mountElement(parentNode, ['details', null, [
      ['summary', null, ['View executed code']],
      ['pre', ['class', 'highlight'], trim(code)],
    ]]);
  }

  function appendChild(currentScript, newNode) {
    const { loaded, parentNode } = currentScript;

    if (!loaded) {
      summarize(currentScript);

      currentScript.loaded = true;
    }

    if (newNode) {
      parentNode.insertBefore(newNode, currentScript);
    }

    return newNode;
  }

  const tests = [];

  window.test = cb => {
    tests.push({
      cb,
      el: document.currentScript,
    });
  };

  window.addEventListener('DOMContentLoaded', () => {
    tests.forEach(t => {
      try {
        t.cb(somedom, x => appendChild(t.el, x));
      } catch (e) {
        console.log(e);
        appendChild(t.el, createElement(['div', ['class', 'error'], e.toString()]));
      }
    });

    window.hijs = '.highlight';

    mountElement('head', ['script', ['src', '//cdn.rawgit.com/cloudhead/hijs/0eaa0031/hijs.js']]);
  });

})();
