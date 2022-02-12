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

  class Fragment {
    constructor() {
      this.childNodes = [];
      this.nodeType = 11;
      this.length = 0;
    }

    appendChild(node) {
      if (node instanceof Fragment) {
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

    remove(wait) {
      wait = wait || (cb => cb());
      return Promise.resolve().then(() => wait(() => this.children.map(sub => sub && sub.remove())));
    }

    mount(target, node) {
      Object.defineProperty(this, 'parentNode', { configurable: true, value: target });

      const doc = this.getDocumentFragment();

      if (node) {
        target.insertBefore(doc, node);
      } else {
        target.appendChild(doc);
      }
    }

    flush(target) {
      if (!this.childNodes.length) {
        this.anchor = document.createTextNode('');
        this.childNodes.push(this.anchor);
        this.length = 1;
      }

      this.anchor = this.childNodes[0];
      this.anchor._anchored = this;
      this.childNodes.forEach(sub => {
        target.appendChild(sub);
      });
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
        if (children[i] === this.anchor) {
          c = i;
          break;
        }
      }
      return c;
    }

    get root() {
      let root = this;
      while (root instanceof Fragment) root = root.parentNode;
      return root;
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

  const isArray = value => Array.isArray(value);
  const isString = value => typeof value === 'string';
  const isFunction = value => typeof value === 'function';
  const isSelector = value => isString(value) && ELEM_REGEX.test(value);
  const isNot = value => typeof value === 'undefined' || value === null;
  const isPlain = value => value !== null && Object.prototype.toString.call(value) === '[object Object]';
  const isObject = value => value !== null && (typeof value === 'function' || typeof value === 'object');
  const isScalar = value => isString(value) || typeof value === 'number' || typeof value === 'boolean';

  const isDiff = (prev, next, isWeak) => {
    if (isWeak && prev === next && (isFunction(prev) || isFunction(next))) return true;
    if (typeof prev !== typeof next) return true;
    if (isArray(prev)) {
      if (prev.length !== next.length) return true;

      for (let i = 0; i < next.length; i += 1) {
        if (isDiff(prev[i], next[i], isWeak)) return true;
      }
    } else if (isPlain(prev) && isPlain(next)) {
      const a = Object.keys(prev).sort();
      const b = Object.keys(next).sort();

      if (isDiff(a, b, isWeak)) return true;

      for (let i = 0; i < a.length; i += 1) {
        if (isDiff(prev[a[i]], next[b[i]], isWeak)) return true;
      }
    } else return prev !== next;
  };

  const isEmpty = value => {
    if (isFunction(value)) return false;
    if (isArray(value)) return value.length === 0;
    if (isPlain(value)) return Object.keys(value).length === 0;

    return isNot(value) || value === false;
  };

  const isNode = x => isArray(x)
    && ((typeof x[0] === 'string' && isSelector(x[0])) || isFunction(x[0]))
    && (x[1] === null || isPlain(x[1]) || isFunction(x[0]));

  const getMethods = obj => {
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
  };

  const dashCase = value => value.replace(/[A-Z]/g, '-$&').toLowerCase();
  const toArray = value => (!isEmpty(value) && !isArray(value) ? [value] : value) || [];
  const filter = (value, cb) => value.filter(cb || (x => !isEmpty(x)));

  const defer = tasks => {
    return tasks.reduce((prev, [x, fn, ...args]) => prev.then(() => fn(...args)).catch(e => {
      throw new Error(`Failed at ${x}\n${e.stack.replace(/^Error:\s+/, '')}`);
    }), Promise.resolve());
  };

  const tree = value => {
    if (isNode(value)) {
      let children = [];
      for (let i = 2; i < value.length; i += 1) {
        children = children.concat(isNode(value[i]) ? [value[i]] : value[i]);
      }
      value.length = 2;
      value.push(children);
    } else if (isArray(value)) {
      return value.map(tree);
    }
    return value;
  };

  const flat = value => {
    return !isArray(value) ? tree(value) : value.reduce((memo, n) => memo.concat(isNode(n) ? [tree(n)] : flat(n)), []);
  };

  const zip = (prev, next, cb, o = 0, p = []) => {
    const c = Math.max(prev.length, next.length);
    const q = [];

    for (let i = 0; i < c; i += 1) {
      const x = flat(prev[i]);
      const y = flat(next[i]);

      if (!isArray(x) && !isArray(y)) {
        q.push([`Node(${JSON.stringify(x)}, ${JSON.stringify(y)})`, cb, x, y, i + o]);
        continue; // eslint-disable-line
      }

      if (isNode(x)) {
        q.push([`Node(${x[0]})`, cb, tree(x), tree(y), i + o]);
      } else if (isArray(x)) {
        if (isNode(y)) {
          q.push(['Zip', zip, x, [y], cb, i + o, p.concat(y[0])]);
        } else if (isArray(y)) {
          q.push(['Zip', zip, x, y, cb, i + o, p]);
        } else {
          q.push(['Zip', zip, x, [y], cb, i + o, p]);
        }
      } else {
        q.push(['Node', cb, x, y, i + o]);
      }
    }
    return defer(q);
  };

  const format = markup => {
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
  };

  const trim = value => {
    const matches = value.match(/\n( )*/);
    const spaces = matches[0].substr(0, matches[0].length - 1);
    const depth = spaces.split('').length;

    return value.replace(new RegExp(`^ {${depth}}`, 'mg'), '').trim();
  };

  const clone$1 = value => {
    if (!value || !isObject(value)) return value;
    if (isArray(value)) return value.map(x => clone$1(x));
    if (value instanceof Date) return new Date(value.getTime());
    if (value instanceof RegExp) return new RegExp(value.source, value.flags);
    return Object.keys(value).reduce((memo, k) => Object.assign(memo, { [k]: clone$1(value[k]) }), {});
  };

  const apply = (cb, length, options = {}) => (...args) => length === args.length && cb(...args, options);
  const raf = cb => ((typeof window !== 'undefined' && window.requestAnimationFrame) || setTimeout)(cb);

  const remove = (target, node) => target && target.removeChild(node);
  const append = (target, node) => (node instanceof Fragment ? node.mount(target) : target.appendChild(node));

  const detach = (target, node) => {
    if (node) {
      if (node instanceof Fragment) {
        node.mount(target.parentNode, target);
      } else {
        target.parentNode.insertBefore(node, target);
      }
    }
    remove(target.parentNode, target);
  };

  function fixProps(vnode) {
    if (isArray(vnode) && isArray(vnode[1])) {
      vnode[2] = vnode[1];
      vnode[1] = null;
    }

    if (!isNode(vnode) || isFunction(vnode[0])) return vnode;

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
      if (prop === 'key') return;

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
      if (k in prev && !(k in next)) {
        all[k] = null;
        changed = true;
      } else if (isDiff(prev[k], next[k], true)) {
        all[k] = next[k];
        changed = true;
      }

      return all;
    }, {});

    if (changed) assignProps(target, props, svg, cb);

    return changed;
  }

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
      return (isScalar(vnode) && document.createTextNode(vnode)) || vnode;
    }

    vnode = tree(vnode);
    while (vnode && isFunction(vnode[0])) {
      vnode = vnode[0](vnode[1], vnode[2]);
      vnode = tree(vnode);
    }

    if (!isArray(vnode)) {
      if (vnode instanceof Fragment) return vnode;
      if (vnode.target) return vnode.target;
      return vnode;
    }

    if (cb && cb.tags && cb.tags[vnode[0]]) {
      return createElement(cb.tags[vnode[0]](vnode[1], vnode[2], cb), svg, cb);
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
    if (el.nodeType === 1) {
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
    }
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

  async function updateElement(target, prev, next, svg, cb, i) {
    if (target.__dirty) return target;
    if (target instanceof Fragment) {
      await updateElement(target.root, target.vnode, target.vnode = next, svg, cb, target.offset); // eslint-disable-line;
      if (isFunction(target.onupdate)) await target.onupdate(target);
      if (isFunction(target.update)) await target.update();
      destroyElement(target.anchor, false);
      return target;
    }
    if (isArray(prev) && isArray(next)) {
      if (isNode(prev) && isNode(next)) {
        return patchNode(target, prev, next, svg, cb);
      } if (!isNode(prev)) {
        if (isNode(next) || target.nodeType === 3) {
          const newNode = createElement(next, svg, cb);

          target.replaceWith(newNode);
          return newNode;
        }
        await zipNodes(prev, next, target, svg, cb, i);
      } else {
        await zipNodes([prev], next, target.parentNode || target, svg, cb, i);
      }
    } else {
      await zipNodes(toArray(prev), toArray(next), target, svg, cb, i);
    }
    return target;
  }

  async function patchNode(target, prev, next, svg, cb) {
    if (prev[0] !== next[0] || isFunction(next[0])) {
      const newNode = createElement(next, svg, cb);

      if (newNode instanceof Fragment) {
        newNode.mount(target.parentNode, target);
        if (isFunction(newNode.onupdate)) await newNode.onupdate(newNode);
        if (isFunction(newNode.update)) await newNode.update();

        const rm = [];

        let leaf = target;
        let c = target._anchored.length;
        while (leaf && c > 0) {
          c -= 1;
          rm.push(leaf);
          leaf = leaf.nextSibling;
        }
        rm.forEach(x => destroyElement(x, false));
      } else {
        if (target._anchored) await target._anchored.remove();
        target.replaceWith(newNode);
      }
      return newNode;
    }
    if (target.nodeType === 1) {
      if (updateProps(target, prev[1] || {}, next[1] || {}, svg, cb)) {
        if (isFunction(target.onupdate)) await target.onupdate(target);
        if (isFunction(target.update)) await target.update();
      }
      if (prev[2] || next[2]) {
        return updateElement(target, !isNode(prev[2]) ? toArray(prev[2]) : [prev[2]], toArray(next[2]), svg, cb);
      }
    } else {
      return patchNode(target, [], next, svg, cb);
    }
    return target;
  }

  function zipNodes(a, b, el, svg, cb, off = 0) {
    let j = off;
    return zip(a, b, async (x, y, z) => {
      let target = el.childNodes[z + j];
      if (isNot(y)) {
        if (!target) {
          while (!el.childNodes[z + j] && (z + j) > 0) j -= 1;
          target = el.childNodes[z + j];
        }
      }

      while (target && target.__dirty) {
        target = el.childNodes[z + ++j]; // eslint-disable-line
      }

      if (target) {
        if (isNot(x)) {
          mountElement(el, y, svg, cb);
        } else if (isNot(y)) {
          await destroyElement(target._anchored || target);
        } else if (isNode(x) && isNode(y)) {
          await patchNode(target, x, y, svg, cb);
          if (target._anchored) j += target._anchored.length;
        } else if (isDiff(x, y)) {
          if (target.nodeType === 3 && !isNode(y) && (!isArray(y) || !y.some(isNode))) {
            target.nodeValue = isArray(y) ? y.join('') : y.toString();
          } else {
            detach(target, createElement(y, svg, cb));
          }
        }
      } else {
        mountElement(el, y, svg, cb);
      }
    });
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

  function createContext(render, callback = fn => fn()) {
    if (typeof render !== 'function' || typeof callback !== 'function') {
      throw new TypeError('Invalid input for createContext()');
    }

    return (...args) => {
      const scope = { c: 0 };

      function end(skip) {
        try {
          scope.get.forEach(fx => {
            if (fx.off) fx.off();
            if (!skip && fx.on && fx.cb) {
              const retval = fx.cb();

              if (typeof retval === 'function') {
                fx.off = retval;
              }
              fx.on = false;
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

      function after() {
        if (scope.get) next(Promise.resolve(end()));
      }

      scope.sync = () => {
        deferred = next(scope.set());
        return deferred;
      };

      return callback(() => {
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
            after();
          }
        })();

        scope.defer = ms => Promise.resolve()
          .then(() => new Promise(ok => setTimeout(() => ok(scope), ms)));

        return scope;
      }, sync => { scope.set = sync; });
    };
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
      scope.val[key] = v;
      scope.sync();
    }];
  }

  function useEffect(callback, inputs) {
    const scope = getContext();
    const key = scope.fx;

    scope.fx += 1;
    scope.in = scope.in || [];
    scope.get = scope.get || [];

    const prev = scope.in[key];
    const enabled = inputs ? !equals(prev, inputs) : true;

    scope.in[key] = inputs;
    scope.get[key] = scope.get[key] || {};

    Object.assign(scope.get[key], { cb: callback, on: enabled });
  }

  var nohooks = {
    clone,
    equals,
    getContext,
    createContext,
    onError,
    useMemo,
    useRef,
    useState,
    useEffect,
  };
  var nohooks_4 = nohooks.createContext;
  var nohooks_5 = nohooks.onError;
  var nohooks_6 = nohooks.useMemo;
  var nohooks_7 = nohooks.useRef;
  var nohooks_8 = nohooks.useState;
  var nohooks_9 = nohooks.useEffect;

  function withContext(tag, view) {
    return nohooks_4(tag, (fn, set) => {
      return view((...args) => fn(...args).result, set);
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

      let vnode;
      let $;

      async function sync(result) {
        await Promise.all(fns.map(fn => fn(data, $)));
        $.target = await updateElement($.target, vnode, vnode = Tag(clone$1(data), $), null, cb);
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

      $.defer = _cb => new Promise(_ => raf(_)).then(_cb);
      $.unmount = _cb => destroyElement($.target, _cb || false);
      $.target = mountElement(el, vnode = Tag(clone$1(data), $), null, cb);

      Object.defineProperty($, 'state', {
        configurable: false,
        enumerable: true,
        get: () => data,
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
      render: cb,
      source: null,
      vnode: vnode || ['div', null],
      thunk: createView(() => ctx.vnode, null),
      defer: _cb => new Promise(_ => raf(_)).then(_cb),
      patch: (target, prev, next) => updateElement(target, prev, next, svg, cb),
    };

    ctx.unmount = async _cb => {
      const tasks = [];

      Object.keys(ctx.refs).forEach(ref => {
        ctx.refs[ref].forEach(thunk => {
          tasks.push(thunk.target.remove());
        });
      });

      await Promise.all(tasks);

      if (ctx.source) {
        destroyElement(ctx.source.target, _cb || false);
      }
    };

    ctx.mount = async (el, _vnode) => {
      await ctx.unmount();

      ctx.vnode = _vnode || ctx.vnode;
      ctx.source = ctx.thunk(el, ctx.render);

      return ctx;
    };

    ctx.wrap = (tag, name) => {
      if (!isFunction(tag)) throw new Error(`Expecting a view factory, given '${tag}'`);

      return (props, children) => {
        const identity = name || tag.name || 'Thunk';
        const target = new Fragment();
        const thunk = tag(props, children)(target, ctx.render);

        ctx.refs[identity] = ctx.refs[identity] || [];
        ctx.refs[identity].push(thunk);

        const _remove = thunk.target.remove;

        thunk.target.remove = target.remove = async _cb => {
          ctx.refs[identity].splice(ctx.refs[identity].indexOf(thunk), 1);

          if (!ctx.refs[identity].length) {
            delete ctx.refs[identity];
          }

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

  var somedom = {
    h,
    pre,
    bind,

    view: createView,
    thunk: createThunk,

    mount: mountElement,
    patch: updateElement,
    render: createElement,
    unmount: destroyElement,

    listeners,
    attributes,

    styles: applyStyles,
    classes: applyClasses,
    animation: applyAnimations,

    onError: nohooks_5,
    useRef: nohooks_7,
    useMemo: nohooks_6,
    useState: nohooks_8,
    useEffect: nohooks_9,
  };

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

}());
