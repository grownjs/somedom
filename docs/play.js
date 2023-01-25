(function () {
  'use strict';

  const RE_XML_SPLIT = /(>)(<)(\/*)/g;
  const RE_XML_CLOSE_END = /.+<\/\w[^>]*>$/;
  const RE_XML_CLOSE_BEGIN = /^<\/\w/;

  const SVG_NS = 'http://www.w3.org/2000/svg';

  const XLINK_NS = 'http://www.w3.org/1999/xlink';
  const ELEM_REGEX = /^(\w*|[.#]\w+)(#[\w-]+)?(\.[\w-][\w-.]*)*$/;

  const EE_SUPPORTED = ['oncreate', 'onupdate', 'ondestroy'];

  const SKIP_METHODS = [
    'constructor',
    'instance',
    'children',
    'render',
    'state',
    'props',
  ];

  /* eslint-disable no-plusplus */

  const BEGIN = Symbol('BEGIN');
  const END = Symbol('END');

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

      this.flush(doc);
      return doc;
    }

    upgrade(next) {
      const q = [];

      let c = this.begin.__length;
      let i = this.offset;
      while (c-- > 0) {
        q.push(this.root.childNodes[i++]);
      }

      this.begin.__length = next.length;
      next.childNodes.forEach(node => {
        this.root.insertBefore(node, this.end);
      });

      return Promise.all(q.map(node => node.remove()));
    }

    remove(wait) {
      wait = wait || (cb => cb());
      return Promise.resolve().then(() => wait(() => this.children.map(sub => sub && sub.remove())));
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

    flush(target) {
      this.begin = document.createTextNode('');
      this.end = document.createTextNode('');

      this.begin.__length = this.childNodes.length;
      this.begin.__mark = BEGIN;
      this.begin.__self = this;
      this.end.__mark = END;

      target.appendChild(this.begin);
      this.childNodes.forEach(sub => target.appendChild(sub));
      target.appendChild(this.end);
      this.childNodes = [];
    }

    get outerHTML() {
      return this.children.map(node => node.outerHTML || node.nodeValue).join('');
    }

    get children() {
      if (this.root) {
        const childNodes = [];
        const { offset } = this;

        for (let i = 0; i < this.length; i += 1) {
          childNodes.push(this.root.childNodes[i + offset]);
        }
        return childNodes;
      }
      return this.childNodes;
    }

    get offset() {
      const children = this.root.childNodes;

      let c = 0;
      for (let i = 0; i < children.length; i += 1) {
        if (children[i] === this.begin) {
          c = i + 1;
          break;
        }
      }
      return c;
    }

    get root() {
      let root = this;
      while (Fragment.valid(root)) root = root.parentNode;
      return root;
    }

    static valid(value) {
      if (value instanceof Fragment) return true;
      return typeof value === 'object' && value.begin && value.nodeType === 11;
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

  /* eslint-disable no-plusplus, no-continue */

  const isString = value => typeof value === 'string';
  const isFunction = value => typeof value === 'function';
  const isNot = value => typeof value === 'undefined' || value === null;
  const isPlain = value => value !== null && Object.prototype.toString.call(value) === '[object Object]';
  const isObject = value => value !== null && (typeof value === 'function' || typeof value === 'object');
  const isScalar = value => isString(value) || typeof value === 'number' || typeof value === 'boolean';

  const isArray = value => Array.isArray(value);
  const isBegin = value => value === BEGIN || (value && value.__mark === BEGIN);
  const isEnd = value => value === END || (value && value.__mark === END);
  const isBlock = value => isArray(value) && !isNode(value);

  function flat(value) {
    return !isArray(value) ? value : value.reduce((memo, n) => memo.concat(isNode(n) ? [n] : flat(n)), []);
  }

  function isEmpty(value) {
    if (isFunction(value)) return false;
    if (isArray(value)) return value.length === 0;
    if (isPlain(value)) return Object.keys(value).length === 0;

    return isNot(value) || value === false;
  }

  function isNode(value) {
    if (!isArray(value)) return false;
    if (typeof value[0] === 'function') return true;
    if (typeof value[1] !== 'object' || isArray(value[1])) return false;
    if (typeof value[0] !== 'string' || value[0].includes(' ')) return false;
    return true;
  }

  function zip(set, prev, next, limit, offset, cb, d = 0) {
    const c = Math.max(prev.length, next.length);

    let i = 0;
    let a = 0;
    let b = 0;
    for (; i < c; i++) {
      let el = set[offset];
      while (el && isEnd(el)) el = el[++offset];

      const x = flat(prev[a]);
      const y = flat(next[b]);

      if (isNot(x)) {
        cb({ add: y });
      } else if (isNot(y)) {
        if (isBegin(el)) {
          const k = el.__length + 2;
          for (let p = 0; p < k; p++) {
            cb({ rm: set[offset++] });
          }
        } else if (isBlock(x)) {
          let k = x.length;
          if (!set[offset]) offset -= k;
          while (k--) cb({ rm: set[offset++] });
        } else if (el) {
          cb({ rm: el });
          offset++;
        }
      } else if (isBlock(x) && isBlock(y)) {
        if (isBegin(el)) {
          cb({ patch: x, with: y, target: el });
          offset += el.__length + 2;
        } else {
          zip(set, x, y, limit, offset, cb, d + 1);
          offset += y.length + 2;
        }
      } else if (isBlock(y)) {
        cb({ patch: [x], with: y, target: el });
        offset += y.length;
      } else if (el) {
        cb({ patch: x, with: y, target: el });
        if (isBegin(el)) {
          offset += el.__length + 2;
        } else {
          offset++;
        }
      } else {
        cb({ add: y });
        offset++;
      }

      if (limit !== null && i >= limit - 1) return;
      a++;
      b++;
    }

    if (offset !== set.length) {
      for (let k = offset; k < set.length; k++) {
        if (isEnd(set[k])) break;
        cb({ rm: set[k] });
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

  function getMethods(obj) {
    const stack = [];

    do {
      stack.push(obj);
    } while (obj = Object.getPrototypeOf(obj)); // eslint-disable-line

    stack.pop();

    return stack.reduce((memo, cur) => {
      const keys = Object.getOwnPropertyNames(cur);

      keys.forEach(key => {
        if (!SKIP_METHODS.includes(key)
          && isFunction(cur[key])
          && !memo.includes(key)
        ) memo.push(key);
      });

      return memo;
    }, []);
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

  function clone$1(value) {
    if (!value || !isObject(value)) return value;
    if (isArray(value)) return value.map(x => clone$1(x));
    if (value instanceof Date) return new Date(value.getTime());
    if (value instanceof RegExp) return new RegExp(value.source, value.flags);
    return Object.keys(value).reduce((memo, k) => Object.assign(memo, { [k]: clone$1(value[k]) }), {});
  }

  const apply = (cb, length, options = {}) => (...args) => length === args.length && cb(...args, options);
  const raf = cb => ((typeof window !== 'undefined' && window.requestAnimationFrame) || setTimeout)(cb);
  const tick = cb => Promise.resolve().then(cb).then(() => new Promise(done => raf(done)));

  const remove = (target, node) => target && target.removeChild(node);
  const append = (target, node) => (Fragment.valid(node) ? node.mount(target) : target.appendChild(node));

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

  function fixProps(vnode) {
    if (isBlock(vnode)) return vnode;

    vnode = [vnode[0], vnode[1], vnode.slice(2)];

    let attrs = isPlain(vnode[1])
      ? { ...vnode[1] }
      : null;

    const matches = vnode[0].match(ELEM_REGEX);

    vnode[0] = matches[1] || 'div';

    if (matches[2]) {
      attrs = vnode[1] = attrs || {};
      attrs.id = matches[2].substr(1);
    }

    if (matches[3]) {
      attrs = vnode[1] = attrs || {};

      const classes = matches[3].substr(1).split('.');

      if (isArray(attrs.class) || isScalar(attrs.class)) {
        attrs.class = !isArray(attrs.class) ? attrs.class.split(/\W/) : attrs.class;
        attrs.class = classes.concat(attrs.class).reduce((prev, cur) => {
          if (prev.indexOf(cur) === -1) prev.push(cur);
          return prev;
        }, []);
      } else if (isObject(attrs.class)) {
        classes.forEach(x => { attrs.class[x] = 1; });
      } else {
        attrs.class = classes;
      }
    }
    return vnode;
  }

  function assignProps(target, attrs, svg, cb) {
    Object.keys(attrs).forEach(prop => {
      if (prop === 'key' || prop.charAt() === ':') return;

      if (prop === 'ref') {
        target.oncreate = el => {
          attrs[prop].current = el;
        };
        return;
      }

      if (prop === '@html') {
        target.innerHTML = attrs[prop];
        return;
      }

      if (prop.charAt() === '@') {
        target.setAttribute(`data-${prop.substr(1)}`, attrs[prop]);
        return;
      }

      if (prop.indexOf('class:') === 0) {
        if (!attrs[prop]) {
          target.classList.remove(prop.substr(6));
        } else {
          target.classList.add(prop.substr(6));
        }
        return;
      }

      if (prop.indexOf('style:') === 0) {
        target.style[camelCase(prop.substr(6))] = attrs[prop];
        return;
      }

      let value = attrs[prop] !== true ? attrs[prop] : prop;
      if (isObject(value)) {
        value = (isFunction(cb) && cb(target, prop, value)) || value;
        value = value !== target ? value : null;
        value = isArray(value)
          ? value.join('')
          : value;
      }

      const removed = isEmpty(value);
      const name = prop.replace(/^xlink:?/, '');

      if (svg && prop !== name) {
        if (removed) target.removeAttributeNS(XLINK_NS, name);
        else target.setAttributeNS(XLINK_NS, name, value);
        return;
      }

      if (removed) target.removeAttribute(prop);
      else if (isScalar(value)) target.setAttribute(prop, value);
    });
  }

  function updateProps(target, prev, next, svg, cb) {
    const keys = Object.keys(prev).concat(Object.keys(next));
    let changed;

    const props = keys.reduce((all, k) => {
      if (k !== '@html') {
        if (k in prev && !(k in next)) {
          all[k] = null;
          changed = true;
        } else if (isDiff(prev[k], next[k])) {
          all[k] = next[k];
          changed = true;
        }
      }
      return all;
    }, {});

    if (changed) assignProps(target, props, svg, cb);

    return changed;
  }

  /* eslint-disable no-restricted-syntax, no-await-in-loop, no-plusplus */

  function destroyElement(target, wait = cb => cb()) {
    const rm = () => target && target.remove();

    return wait === false ? rm() : Promise.resolve().then(() => wait(rm));
  }

  function createElement(vnode, svg, cb) {
    if (isNot(vnode)) throw new Error(`Invalid vnode, given '${vnode}'`);
    if (!isNode(vnode)) {
      if (isArray(vnode)) {
        return Fragment.from(v => createElement(v, svg, cb), vnode);
      }
      return (isScalar(vnode) && document.createTextNode(String(vnode))) || vnode;
    }

    while (vnode && isFunction(vnode[0])) {
      vnode = vnode[0](vnode[1], vnode.slice(2));
    }

    if (!isArray(vnode)) {
      if (Fragment.valid(vnode)) return vnode;
      if (vnode.target) return vnode.target;
      return vnode;
    }

    if (cb && cb.tags && cb.tags[vnode[0]]) {
      return createElement(cb.tags[vnode[0]](vnode[1], vnode.slice(2), cb), svg, cb);
    }

    if (!isNode(vnode)) {
      return Fragment.from(v => createElement(v, svg, cb), vnode);
    }

    const isSvg = svg || vnode[0].indexOf('svg') === 0;
    const [tag, props, children] = fixProps(vnode);

    let el = isSvg
      ? document.createElementNS(SVG_NS, tag)
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
      const newNode = createElement(view, svg, cb);

      append(target, newNode);
      return newNode;
    }
    return target;
  }

  async function upgradeNode(target, prev, next, svg, cb) {
    if (!isNode(prev) || prev[0] !== next[0] || target.nodeType !== 1) {
      const newNode = createElement(next, svg, cb);

      if (Fragment.valid(newNode)) {
        detach(target, newNode);
      } else {
        target.replaceWith(newNode);
      }
      return newNode;
    }

    if (updateProps(target, prev[1] || {}, next[1] || {}, svg, cb)) {
      if (isFunction(target.onupdate)) await target.onupdate(target);
      if (isFunction(target.update)) await target.update();
    }

    if (next[1] && next[1]['@html']) {
      target.innerHTML = next[1]['@html'];
      return target;
    }

    return updateElement(target, prev.slice(2), next.slice(2), svg, cb);
  }

  async function upgradeFragment(target, prev, next, svg, cb) {
    if (isFunction(next[0])) {
      const newNode = createElement(next, svg, cb);

      if (Fragment.valid(newNode)) {
        if (isBegin(target)) {
          await target.__self.upgrade(newNode);
          if (isFunction(newNode.onupdate)) await newNode.onupdate(newNode);
          if (isFunction(newNode.update)) await newNode.update();
          target = newNode;
        } else {
          detach(target, newNode);
        }
      } else {
        target.replaceWith(newNode);
        return newNode;
      }
      return target;
    }
  }

  async function upgradeElement(target, prev, next, el, svg, cb) {
    const newNode = createElement(next, svg, cb);

    newNode.onupdate = prev.onupdate || newNode.onupdate;
    newNode.update = prev.update || newNode.update;

    if (Fragment.valid(newNode)) {
      newNode.mount(el, target);
    } else {
      el.insertBefore(newNode, target);
    }
    return newNode;
  }

  async function upgradeElements(target, prev, next, svg, cb, i, c) {
    const stack = [];
    const set = target.childNodes;
    const push = v => stack.push(v);

    if (!isBlock(next)) next = [next];

    if (target.nodeType === 3) {
      const newNode = createElement(next, svg, cb);

      detach(target, newNode);
      return newNode;
    }

    zip(set, prev, next, c || null, i || 0, push);

    let j = 0;
    for (const task of stack) {
      if (c !== null && j++ >= c) break;

      if (task.rm) {
        await destroyElement(task.rm);
      }
      if (!isNot(task.patch)) {
        if (!task.target.parentNode) {
          task.add = task.with;
        } else {
          await patchNode(task.target, task.patch, task.with, svg, cb);
        }
      }
      if (!isNot(task.add)) {
        const newNode = createElement(task.add, svg, cb);

        if (Fragment.valid(newNode)) {
          newNode.mount(target);
        } else {
          target.appendChild(newNode);
        }
      }
    }
  }

  async function updateElement(target, prev, next, svg, cb, i, c) {
    if (target.__update) {
      return target.__update ? target.__update(target, prev, next, svg, cb, i, c) : target;
    }

    if (Fragment.valid(target)) {
      await upgradeElements(target.root, prev, next, svg, cb, target.offset, target.length);
      return target;
    }

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

    await upgradeElements(target, prev, next, svg, cb, i, c);
    return target;
  }

  async function destroyFragment(target, next, svg, cb) {
    const del = target.__length + 2;
    const el = target.parentNode;
    const on = target;
    const q = [];

    for (let k = 0; k < del; k++) {
      if (!target) break;
      q.push(target);
      target = target.nextSibling;
    }

    await Promise.all(q.map(node => destroyElement(node)));
    await upgradeElement(target, on, next, el, svg, cb);
    return target;
  }

  async function patchNode(target, prev, next, svg, cb) {
    const newNode = await upgradeFragment(target, prev, next, svg, cb);

    if (!newNode && isDiff(prev, next)) {
      if (target.nodeType === 3) {
        if (isBegin(target)) {
          await destroyFragment(target, next, svg, cb);
        } else if (isNode(next)) {
          target = await upgradeNode(target, prev, next, svg, cb);
        } else {
          for (let k = next.length - prev.length; k > 0; k--) await destroyElement(target.nextSibling || null);

          if (isBlock(prev) && isBlock(next)) {
            detach(target, createElement(next, svg, cb));
          } else {
            target.nodeValue = String(next);
          }
        }
      } else if (target.nodeType === 1) {
        target = await upgradeNode(target, prev, next, svg, cb);
      } else {
        target = await updateElement(target, prev, next, svg, cb);
      }
    } else {
      target = newNode;
    }
    return target;
  }

  const contextStack = [];

  function getContext() {
    const scope = contextStack[contextStack.length - 1];

    if (!scope) {
      throw new Error('Cannot invoke hooks outside createContext()');
    }
    return scope;
  }

  function pop(scope) {
    contextStack[contextStack.indexOf(scope)] = null;
  }

  function push(scope) {
    contextStack.push(scope);
  }

  function isObj(value) {
    return value !== null && typeof value === 'object';
  }

  function undef(value) {
    return typeof value === 'undefined' || value === null;
  }

  function clone(value) {
    if (!value || !isObj(value)) return value;
    if (Array.isArray(value)) return value.map(x => clone(x));
    if (value instanceof Date) return new Date(value.getTime());
    if (value instanceof RegExp) return new RegExp(value.source, value.flags);
    return Object.keys(value).reduce((memo, k) => Object.assign(memo, { [k]: clone(value[k]) }), {});
  }

  function equals(a, b) {
    if (typeof a !== typeof b) return;
    if (a instanceof Array) {
      if (a.length !== b.length) return;
      for (let i = 0; i < a.length; i += 1) {
        if (!equals(a[i], b[i])) return;
      }
      return true;
    }
    if (a && b && a.constructor === Object) {
      const x = Object.keys(a).sort();
      if (!equals(x, Object.keys(b).sort())) return;
      for (let i = 0; i < x.length; i += 1) {
        if (!equals(a[x[i]], b[x[i]])) return;
      }
      return true;
    }
    return a === b;
  }

  class Context {
    constructor(args, render, callback) {
      const scope = this;

      scope.c = 0;

      function end(skip) {
        try {
          scope.get.forEach(fx => {
            if (fx.off && !fx.once) {
              fx.off();
              fx.off = null;
            }

            if (fx.once && fx.cb && !fx.off) {
              const retval = fx.cb();

              fx.once = false;
              if (typeof retval === 'function') {
                fx.off = retval;
              }
            }

            if (skip === null && fx.on && fx.cb) {
              const retval = fx.cb();

              fx.on = false;
              if (typeof retval === 'function') {
                fx.off = retval;
              }
            }

            if (skip === false && fx.off) {
              fx.off();
              fx.off = null;
            }
          });
        } catch (e) {
          return Promise.reject(e);
        }
      }

      let deferred;
      function next(promise) {
        promise.catch(e => {
          if (scope.get) setTimeout(() => end(true));
          if (scope.onError) {
            scope.onError(e);
          } else {
            throw e;
          }
        }).then(() => {
          deferred = null;
        });
      }

      function after(clear) {
        if (scope.get) next(Promise.resolve(end(clear)));
      }

      scope.defer = ms => Promise.resolve()
        .then(() => new Promise(ok => setTimeout(() => ok(scope), ms)));

      scope.clear = () => {
        if (scope.get) after(false);
      };

      scope.sync = () => {
        deferred = next(scope.set());
        return deferred;
      };

      scope.run = callback(() => {
  (function loop() { // eslint-disable-line
          scope.set = scope.set || (() => Promise.resolve().then(() => {
            if (!equals(scope.val, scope.old)) loop();
          }));

          scope.old = clone(scope.val);
          scope.key = 0;
          scope.fx = 0;
          scope.m = 0;
          scope.c += 1;

          push(scope);

          try {
            scope.result = render(...args);

            const key = [scope.key, scope.fx, scope.m].join('.');

            if (!scope.hash) {
              scope.hash = key;
            } else if (scope.hash !== key) {
              throw new Error('Hooks must be called in a predictable way');
            }
            return scope.result;
          } catch (e) {
            throw new Error(`Unexpected failure in context\n${e.message}`);
          } finally {
            pop(scope);
            after(null);
          }
        })();

        return scope;
      }, sync => { scope.set = sync; });
    }
  }

  function createContext(render, callback = fn => fn()) {
    if (typeof render !== 'function' || typeof callback !== 'function') {
      throw new TypeError('Invalid input for createContext()');
    }

    return (...args) => new Context(args, render, callback).run;
  }

  function onError(callback) {
    getContext().onError = callback;
  }

  function useMemo(callback, inputs) {
    const scope = getContext();
    const key = scope.m;

    scope.m += 1;
    scope.v = scope.v || [];
    scope.d = scope.d || [];

    const prev = scope.d[key];

    if (undef(prev) || !equals(prev, inputs)) {
      scope.v[key] = callback();
      scope.d[key] = inputs;
    }
    return scope.v[key];
  }

  function useRef(result) {
    return useMemo(() => {
      let value = clone(result);

      return Object.defineProperty({}, 'current', {
        configurable: false,
        enumerable: true,
        set: ref => { value = ref; },
        get: () => value,
      });
    }, []);
  }

  function useState(fallback) {
    const scope = getContext();
    const key = scope.key;

    scope.key += 1;
    scope.val = scope.val || [];

    if (undef(scope.val[key])) {
      scope.val[key] = fallback;
    }

    return [scope.val[key], v => {
      if (typeof v === 'function') {
        scope.val[key] = v(scope.val[key]);
      } else {
        scope.val[key] = v;
      }
      scope.sync();
      return scope.val[key];
    }];
  }

  function useEffect(callback, inputs) {
    const scope = getContext();
    const key = scope.fx;

    scope.fx += 1;
    scope.in = scope.in || [];
    scope.get = scope.get || [];

    const prev = scope.in[key];
    const scoped = !inputs || !inputs.length;
    const enabled = !scoped && !equals(prev, inputs);

    scope.in[key] = inputs;
    scope.get[key] = scope.get[key] || {};

    Object.assign(scope.get[key], { cb: callback, on: enabled, once: scoped });
  }

  var nohooks = {
    clone,
    equals,
    Context,
    getContext,
    createContext,
    onError,
    useMemo,
    useRef,
    useState,
    useEffect,
  };
  var nohooks_2 = nohooks.equals;
  var nohooks_3 = nohooks.Context;
  var nohooks_5 = nohooks.createContext;
  var nohooks_6 = nohooks.onError;
  var nohooks_7 = nohooks.useMemo;
  var nohooks_8 = nohooks.useRef;
  var nohooks_9 = nohooks.useState;
  var nohooks_10 = nohooks.useEffect;

  function withContext(tag, view) {
    return nohooks_5(tag, (fn, set) => {
      return view((...args) => fn(...args), set);
    });
  }

  function getDecorated(Tag, state, actions, children) {
    if (isPlain(Tag) && isFunction(Tag.render)) {
      const factory = Tag;

      Tag = (_state, _actions) => factory.render(_state, _actions, children);

      state = isFunction(factory.state) ? factory.state(state) : factory.state || state;
      actions = Object.keys(factory).reduce((memo, key) => {
        if (!SKIP_METHODS.includes(key) && isFunction(factory[key])) {
          memo[key] = (...args) => factory[key](...args);
        }
        return memo;
      }, {});
    }

    let instance;
    if (
      isFunction(Tag)
      && (Tag.prototype && isFunction(Tag.prototype.render))
      && (Tag.constructor === Function && Tag.prototype.constructor !== Function)
    ) {
      instance = new Tag(state, children);
      instance.props = clone$1(state || {});

      Tag = _state => (instance.state = _state, instance.render()); // eslint-disable-line

      state = isFunction(instance.state) ? instance.state(state) : instance.state || state;
      actions = getMethods(instance).reduce((memo, key) => {
        if (key.charAt() !== '_') {
          const method = instance[key].bind(instance);

          memo[key] = (...args) => () => method(...args);
          instance[key] = (...args) => memo[key](...args);
        }
        return memo;
      }, {});
    }

    return {
      Tag, state, actions, instance,
    };
  }

  function createView(Factory, initialState, userActions, refreshCallback) {
    const children = isArray(userActions) ? userActions : undefined;

    userActions = isPlain(userActions) ? userActions : {};

    if (isFunction(initialState)) {
      refreshCallback = initialState;
      initialState = null;
    }

    const {
      Tag, state, actions, instance,
    } = getDecorated(Factory, initialState, userActions, children);

    if (!instance && isFunction(Factory) && arguments.length === 1) {
      return withContext(Factory, createView);
    }

    return (el, cb = createElement, hook = refreshCallback) => {
      const data = clone$1(state || {});
      const fns = [];

      let context;
      let vnode;
      let $;

      function get() {
        let next = Tag(clone$1(data), $);
        context = null;
        if (next && next instanceof nohooks_3) {
          context = next;
          next = next.result;
        }
        return next;
      }

      async function sync(result) {
        await Promise.all(fns.map(fn => fn(data, $)));
        $.target = await updateElement($.target, vnode, vnode = get(), null, cb);
        return result;
      }

      if (hook) {
        hook(payload => sync(Object.assign(data, payload)));
      }

      // decorate given actions
      $ = Object.keys(actions).reduce((memo, fn) => {
        const method = actions[fn];

        if (!isFunction(method)) {
          throw new Error(`Invalid action, given ${method} (${fn})`);
        }

        memo[fn] = (...args) => {
          const retval = method(...args)(data, $);

          if (isObject(retval) && isFunction(retval.then)) {
            return retval.then(result => {
              if (isPlain(result)) {
                return sync(Object.assign(data, result));
              }
              return result;
            });
          }

          if (isPlain(retval)) {
            sync(Object.assign(data, retval));
          }
          return retval;
        };

        if (instance) {
          instance[fn] = memo[fn];
        }
        return memo;
      }, Object.create(null));

      $.subscribe = fn => {
        Promise.resolve(fn(data, $)).then(() => fns.push(fn));

        return () => {
          fns.splice(fns.indexOf(fn), 1);
        };
      };

      $.teardown = () => context && context.clear();
      $.defer = _cb => new Promise(_ => raf(_)).then(_cb);
      $.target = mountElement(el, vnode = get(), null, cb);
      $.unmount = _cb => destroyElement($.target, _cb || false);

      Object.defineProperty($, 'state', {
        configurable: false,
        enumerable: true,
        get: () => context || data,
        set: v => Object.assign(context || data, v),
      });

      if (instance) {
        $.instance = instance;
      }
      return $;
    };
  }

  function createThunk(vnode, svg, cb = createElement) {
    if (typeof svg === 'function') {
      cb = svg;
      svg = null;
    }

    const ctx = {
      refs: {},
      stack: [],
      render: cb,
      source: null,
      vnode: vnode || ['div', null],
      thunk: createView(() => ctx.vnode, null),
      defer: _cb => new Promise(_ => raf(_)).then(_cb),
      patch: (target, prev, next) => updateElement(target, prev, next, svg, cb),
    };

    ctx.unmount = async () => {
      const tasks = [];

      Object.keys(ctx.refs).forEach(ref => {
        ctx.refs[ref].forEach(thunk => {
          tasks.push(thunk.target.remove());
        });
      });

      await Promise.all(tasks);
    };

    ctx.mount = async (el, _vnode, _remove) => {
      if (_remove) {
        while (el.firstChild) el.removeChild(el.firstChild);
      }

      await ctx.unmount();

      ctx.vnode = _vnode || ctx.vnode;
      ctx.source = ctx.thunk(el, ctx.render);

      return ctx;
    };

    ctx.clear = () => {
      ctx.stack.forEach(fn => fn());
    };

    ctx.wrap = (tag, name) => {
      if (!isFunction(tag)) throw new Error(`Expecting a view factory, given '${tag}'`);

      return (props, children) => {
        const identity = name || tag.name || 'Thunk';
        const target = new Fragment();
        const thunk = tag(props, children)(target, ctx.render);

        if (thunk.teardown) {
          ctx.stack.push(thunk.teardown);
        }

        ctx.refs[identity] = ctx.refs[identity] || [];
        ctx.refs[identity].push(thunk);

        const _remove = thunk.target.remove.bind(thunk.target);

        thunk.target.remove = target.remove = async _cb => {
          if (thunk.teardown) {
            thunk.teardown();
            ctx.stack.splice(ctx.stack.indexOf(thunk.teardown), 1);
          }

          ctx.refs[identity].splice(ctx.refs[identity].indexOf(thunk), 1);
          if (!ctx.refs[identity].length) delete ctx.refs[identity];
          return _remove(_cb);
        };

        return target;
      };
    };

    return ctx;
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

  /* eslint-disable no-plusplus, no-await-in-loop */

  const CACHED_FRAGMENTS = new Map();

  let FRAGMENT_FX = [];
  class FragmentList {
    constructor(props, children, callback = createElement) {
      if (props instanceof window.HTMLElement) {
        this.props = {};
        this.vnode = children;
        this.target = props;
        this.render = callback;
      } else {
        props.name = props.name || `fragment-${Math.random().toString(36).substr(2)}`;

        this.target = document.createElement(props.tag || 'x-fragment');

        delete props.tag;

        this.props = {};
        this.vnode = null;
        this.render = callback;
        this.touch(props, children);
      }

      this.target.__update = (_, prev, next) => {
        this.vnode = prev || this.vnode;
        this.patch(next);
      };

      let promise = Promise.resolve();
      Object.defineProperty(this, '__defer', {
        set: p => promise.then(() => { promise = p; }),
        get: () => promise,
      });
    }

    async update(children) {
      try {
        this.patch(children);
        await tick();
      } finally {
        await this.__defer;
      }
      return this;
    }

    prepend(children) { return this.sync(children, -1); }

    append(children) { return this.sync(children, 1); }

    patch(children) {
      if (this.vnode) {
        this.__defer = upgradeElements(this.target, this.vnode, this.vnode = children, null, this.render);
      } else {
        const frag = this.render(this.vnode = children);
        const anchor = this.target.firstChild;

        frag.childNodes.forEach(sub => this.target.insertBefore(sub, anchor));
      }
      return this;
    }

    touch(props, children) {
      delete props.tag;
      updateProps(this.target, this.props, props, null, this.render);
      return children ? this.patch(children) : this;
    }

    sync(children, direction) {
      if (!isBlock(children)) {
        throw new Error(`Fragments should be lists of nodes, given '${JSON.stringify(children)}'`);
      }

      if (!direction) return this.patch(children);
      if (this.mounted) {
        if (direction < 0) {
          this.vnode.unshift(...children);
        } else {
          this.vnode.push(...children);
        }

        const frag = this.render(children);
        if (direction < 0) {
          frag.mount(this.target, this.target.firstChild);
        } else {
          frag.mount(this.target);
        }
      }
      return this;
    }

    get root() {
      return this.target
        && this.target.parentNode;
    }

    get mounted() {
      return !!(this.root
        && this.root.isConnected
        && this.target.isConnected);
    }

    static from(props, children, callback) {
      let frag;
      if (typeof props === 'string') {
        frag = CACHED_FRAGMENTS.get(props);
      } else if (props['@html']) {
        const doc = document.createDocumentFragment();
        const div = document.createElement('div');

        div.innerHTML = props['@html'];
        [].slice.call(div.childNodes).forEach(node => {
          doc.appendChild(node);
        });
        return { target: doc };
      } else if (!CACHED_FRAGMENTS.has(props.name)) {
        CACHED_FRAGMENTS.set(props.name, frag = new FragmentList(props, children, callback));
      } else {
        frag = CACHED_FRAGMENTS.get(props.name).touch(props, children);
      }
      return frag;
    }

    static stop() {
      try {
        FRAGMENT_FX.forEach(fn => fn());
      } finally {
        FRAGMENT_FX = [];
      }
    }

    static with(id, cb) {
      return FragmentList.for(id)
        .then(frag => {
          const fn = cb(frag);

          if (typeof fn === 'function') {
            FRAGMENT_FX.push(fn);
          }
          return frag;
        });
    }

    static del(id) {
      CACHED_FRAGMENTS.delete(id);
    }

    static has(id) {
      return CACHED_FRAGMENTS.has(id)
        && CACHED_FRAGMENTS.get(id).mounted;
    }

    static for(id, retries = 0) {
      return new Promise(ok => {
        if (retries++ > 100) {
          throw new ReferenceError(`Fragment not found, given '${id}'`);
        }

        if (!FragmentList.has(id)) {
          raf(() => ok(FragmentList.for(id, retries + 1)));
        } else {
          ok(CACHED_FRAGMENTS.get(id));
        }
      });
    }
  }

  const h = (tag = 'div', attrs = null, ...children) => {
    if (isScalar(attrs)) return [tag, null, [attrs].concat(children).filter(x => !isNot(x))];
    if (isArray(attrs)) return [tag, null, attrs];
    return [tag, attrs || null, children];
  };

  const pre = (vnode, svg, cb = createElement) => {
    return cb(['pre', { class: 'highlight' }, format(cb(vnode, svg).outerHTML)], svg);
  };

  const bind = (tag, ...hooks) => {
    const cbs = filter(hooks, isFunction);

    const mix = (...args) => {
      return cbs.reduce((prev, cb) => cb(...args) || prev, undefined);
    };

    const cb = (...args) => (args.length <= 2 ? tag(args[0], args[1], mix) : mix(...args));

    const $ = () => new Fragment();

    cb.tags = mix.tags = Object.assign({},
      ...filter(hooks, x => isArray(x) || isPlain(x))
        .reduce((memo, cur) => memo.concat(cur), []).filter(isPlain));

    cb.view = (Tag, name) => {
      function Factory(ref, props, children) {
        if (!children && isArray(props)) {
          children = props;
          props = ref || null;
          ref = null;
        }

        if (this instanceof Factory) {
          if (isNot(props)) {
            props = ref;
            ref = null;
          }

          return createView(Tag)(props, children)(ref, cb);
        }

        return createView(Tag)(props, children)(ref || $(), cb);
      }

      Object.defineProperty(Factory, 'name', {
        value: name || Tag.name || 'View',
      });

      return Factory;
    };

    cb.tag = (Tag, name) => {
      const mount$ = cb.view(Tag, name);

      return (props, children) => {
        return mount$($(), props, children).target;
      };
    };

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
    FragmentList: FragmentList,
    raf: raf,
    tick: tick,
    format: format,
    mount: mountElement,
    patch: updateElement,
    render: createElement,
    unmount: destroyElement,
    view: createView,
    thunk: createThunk,
    equals: nohooks_2,
    onError: nohooks_6,
    useRef: nohooks_8,
    useMemo: nohooks_7,
    useState: nohooks_9,
    useEffect: nohooks_10,
    createContext: nohooks_5,
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
      ['pre', { class: 'highlight' }, trim(code)],
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
        appendChild(t.el, createElement(['div', { class: 'error' }, e.toString()]));
      }
    });

    window.hijs = '.highlight';

    mountElement('head', ['script', { src: '//cdn.rawgit.com/cloudhead/hijs/0eaa0031/hijs.js' }]);
  });

})();
