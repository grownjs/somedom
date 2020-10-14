(function () {
  'use strict';

  class Fragment {
    constructor(data, cb) {
      this.childNodes = [];

      if (data) {
        data.forEach(node => {
          this.appendChild(cb(node));
        });
      }
    }

    replaceChild(node, target) {
      const i = this.childNodes.indexOf(target);

      if (i !== -1) {
        this.childNodes[i] = node;
      }
    }

    appendChild(node) {
      this.childNodes.push(node);
    }

    mount(target) {
      this.childNodes.forEach(node => {
        target.appendChild(node);
      });
    }

    get outerHTML() {
      return this.childNodes.map(node => node.outerHTML || node.nodeValue).join('');
    }
  }

  const RE_XML_SPLIT = /(>)(<)(\/*)/g;
  const RE_XML_OPEN = /^<\w([^>]*[^/])?>.*$/;
  const RE_XML_CLOSE_END = /.+<\/\w[^>]*>$/;
  const RE_XML_CLOSE_BEGIN = /^<\/\w/;

  const SVG_NS = 'http://www.w3.org/2000/svg';

  const XLINK_NS = 'http://www.w3.org/1999/xlink';
  const ELEM_REGEX = /^(\w*|[.#]\w+)(#[\w-]+)?([\w.-]+)?$/;

  const EE_SUPPORTED = ['oncreate', 'onupdate', 'ondestroy'];

  const SKIP_METHODS = [
    'constructor',
    'children',
    'render',
    'state',
    'props',
  ];

  const isArray = value => Array.isArray(value);
  const isFunction = value => typeof value === 'function';
  const isSelector = value => value && ELEM_REGEX.test(value);
  const isUndef = value => typeof value === 'undefined' || value === null;
  const isPlain = value => value !== null && Object.prototype.toString.call(value) === '[object Object]';
  const isObject = value => value !== null && (typeof value === 'function' || typeof value === 'object');
  const isScalar = value => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';

  const isDiff = (prev, next) => {
    if (isFunction(prev) || isFunction(next) || typeof prev !== typeof next) return true;
    if (isArray(prev)) {
      if (prev.length !== next.length) return true;

      for (let i = 0; i < next.length; i += 1) {
        if (isDiff(prev[i], next[i])) return true;
      }
    } else if (isPlain(prev)) {
      const a = Object.keys(prev).sort();
      const b = Object.keys(next).sort();

      if (isDiff(a, b)) return true;

      for (let i = 0; i < a.length; i += 1) {
        if (isDiff(prev[a[i]], next[b[i]])) return true;
      }
    } else return prev !== next;
  };

  const isEmpty = value => {
    if (isFunction(value)) return false;
    if (isArray(value)) return value.length === 0;
    if (isPlain(value)) return Object.keys(value).length === 0;

    return typeof value === 'undefined' || value === '' || value === null || value === false;
  };

  const isNode = x => isArray(x) && x.length <= 3 && ((typeof x[0] === 'string' && isSelector(x[0])) || isFunction(x[0]));

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
          && typeof cur[key] === 'function'
          && !memo.includes(key)
        ) memo.push(key);
      });

      return memo;
    }, []);
  };

  const dashCase = value => value.replace(/[A-Z]/g, '-$&').toLowerCase();
  const toArray = value => (!isEmpty(value) && !isArray(value) ? [value] : value) || [];
  const filter = (value, cb) => value.filter(cb || (x => !isEmpty(x)));

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
      } else if (RE_XML_OPEN.test(line)) {
        indent = 1;
      } else {
        indent = 0;
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

  const clone = value => {
    if (!value || typeof value !== 'object') return value;
    if (isArray(value)) return value.map(x => clone(x));
    if (value instanceof Date) return new Date(value.getTime());
    if (value instanceof RegExp) return new RegExp(value.source, value.flags);
    return Object.keys(value).reduce((memo, k) => Object.assign(memo, { [k]: clone(value[k]) }), {});
  };

  function sortedZip(prev, next, cb) {
    const length = Math.max(prev.length, next.length);

    for (let i = 0; i < length; i += 1) {
      if (isDiff(prev[i], next[i])) {
        cb(prev[i] || null, next[i] || null, i);
      }
    }
  }

  const apply = (cb, length, options = {}) => (...args) => length === args.length && cb(...args, options);
  const raf = cb => ((typeof window !== 'undefined' && window.requestAnimationFrame) || setTimeout)(cb);

  const append = (target, node) => (node instanceof Fragment ? node.mount(target) : target.appendChild(node));
  const replace = (target, node, i) => target.replaceChild(node, target.childNodes[i]);
  const remove = (target, node) => target && target.removeChild(node);

  const detach = (target, node) => {
    if (node) target.parentNode.insertBefore(node, target);
    remove(target.parentNode, target);
  };

  function fixTree(vnode) {
    if (isArray(vnode)) {
      if (!(isNode(vnode) || vnode.some(isNode))) {
        return vnode.reduce((memo, cur) => memo.concat(fixTree(cur)), []);
      }

      if (isFunction(vnode[0])) {
        return fixTree(vnode[0](vnode[1], toArray(vnode[2])));
      }

      return vnode.map(fixTree);
    }

    return vnode;
  }

  function fixProps(vnode) {
    if (isScalar(vnode) || !isNode(vnode)) return vnode;
    if (isArray(vnode[1]) || isScalar(vnode[1])) {
      vnode[2] = vnode[1];
      vnode[1] = null;
    }

    vnode[2] = fixTree(toArray(vnode[2]));

    if (isFunction(vnode[0])) return vnode;
    if (!isNode(vnode)) throw new Error(`Invalid vnode, given '${vnode}'`);

    const matches = vnode[0].match(ELEM_REGEX);
    const name = matches[1] || 'div';
    const attrs = { ...vnode[1] };

    if (matches[2]) {
      attrs.id = matches[2].substr(1);
    }

    if (matches[3]) {
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

    return [name, attrs, vnode[2]];
  }

  function assignProps(target, attrs, svg, cb) {
    Object.keys(attrs).forEach(prop => {
      if (prop === 'key' || isObject(attrs[prop])) {
        attrs[prop] = (isFunction(cb) && cb(target, prop, attrs[prop])) || null;

        if (prop === 'key') return;
      }

      const removed = isEmpty(attrs[prop]);
      const value = attrs[prop] === true ? prop : attrs[prop];
      const name = prop.replace(/^xlink:?/, '');

      if (svg && prop !== name) {
        if (removed) target.removeAttributeNS(XLINK_NS, name);
        else target.setAttributeNS(XLINK_NS, name, value);
        return;
      }

      if (removed) target.removeAttribute(prop);
      else target.setAttribute(prop, value);
    });
  }

  function updateProps(target, prev, next, svg, cb) {
    let changed;

    const keys = Object.keys(prev).concat(Object.keys(next));
    const props = keys.reduce((all, k) => {
      if (k in prev && !(k in next)) {
        all[k] = null;
        changed = true;
      } else if (isDiff(prev[k], next[k])) {
        all[k] = next[k];
        changed = true;
      }

      return all;
    }, {});

    if (changed) assignProps(target, props, svg, cb);

    return changed;
  }

  function destroyElement(target, wait = cb => cb()) {
    return Promise.resolve().then(() => wait(() => target.remove()));
  }

  function createElement(value, svg, cb) {
    if (isScalar(value)) return document.createTextNode(value);
    if (isUndef(value)) throw new Error(`Invalid vnode, given '${value}'`);

    if (!isNode(value)) {
      return isArray(value)
        ? new Fragment(fixTree(value), node => createElement(node, svg, cb))
        : value;
    }

    let fixedVNode = fixProps(value);

    if (isFunction(fixedVNode[0])) {
      const retval = fixedVNode[0](fixedVNode[1], fixedVNode[2]);

      while (isFunction(retval[0])) {
        retval[0] = retval[0](fixedVNode[1], fixedVNode[2]);
      }

      if (isNode(retval)) {
        fixedVNode = fixProps(retval);
      } else {
        return retval[0];
      }
    }

    const [tag, attrs, children] = fixedVNode;
    const isSvg = svg || tag === 'svg';

    let el = isSvg
      ? document.createElementNS(SVG_NS, tag)
      : document.createElement(tag);

    if (isFunction(cb)) {
      el = cb(el, tag, attrs, children) || el;
    }

    if (isFunction(el)) return createElement(el(), isSvg, cb);
    if (!isEmpty(attrs)) assignProps(el, attrs, isSvg, cb);
    if (isFunction(el.oncreate)) el.oncreate(el);
    if (isFunction(el.enter)) el.enter();

    el.remove = () => Promise.resolve()
      .then(() => isFunction(el.ondestroy) && el.ondestroy(el))
      .then(() => isFunction(el.teardown) && el.teardown())
      .then(() => isFunction(el.exit) && el.exit())
      .then(() => detach(el));

    children.forEach(vnode => {
      if (!isEmpty(vnode)) append(el, createElement(vnode, isSvg, cb));
    });

    return el;
  }

  function mountElement(target, view, cb = createElement) {
    if (typeof view === 'function') {
      cb = view;
      view = target;
      target = undefined;
    }

    if (!view) {
      view = target;
      target = undefined;
    }

    if (!target) {
      target = document.body;
    }

    if (typeof target === 'string') {
      target = document.querySelector(target);
    }

    const el = isArray(view) || isScalar(view) ? cb(view) : view;

    append(target, el);

    return el;
  }

  function updateElement(target, prev, next, svg, cb, i = null) {
    if (i === null) {
      if (isArray(prev) && isArray(next)) {
        const a = fixProps(prev);
        const b = fixProps(next);

        if (isNode(a) && isNode(b)) {
          if (target.nodeType === 1 && target.tagName.toLowerCase() === a[0]) {
            if (updateProps(target, a[1], b[1], svg, cb)) {
              if (isFunction(target.onupdate)) target.onupdate(target);
              if (isFunction(target.update)) target.update();
            }

            sortedZip(a[2], b[2], (x, y, z) => updateElement(target, x, y, svg, cb, z));
          } else if (target.nodeType === 1) {
            if (a && b && a[0] === b[0]) {
              updateElement(target.childNodes[0], a, b, svg, cb, null);
            } else {
              detach(target.childNodes[0], createElement(b, svg, cb));
            }
          } else {
            detach(target, createElement(b, svg, cb));
          }
        } else if (!isNode(a) && !isNode(b)) {
          sortedZip(a, b, (x, y, z) => updateElement(target, x, y, svg, cb, z));
        } else {
          replace(target, createElement(b, svg, cb), 0);
        }
      }
    } else if (target.childNodes[i]) {
      if (next === null) {
        destroyElement(target.childNodes[i]);
      } else if (isScalar(prev) && isScalar(next)) {
        if (prev !== next) target.childNodes[i].nodeValue = next;
      } else if (prev && next && prev[0] === next[0] && target.nodeType === 1) {
        updateElement(target.childNodes[i], prev, next, svg, cb, null);
      } else {
        replace(target, createElement(next, svg, cb), i);
      }
    } else {
      append(target, createElement(next, svg, cb));
    }
  }

  const STACK = [];

  function pop(scope) {
    STACK.splice(STACK.indexOf(scope), 1);
  }

  function push(scope) {
    STACK.push(scope);
  }

  function getContext() {
    return STACK[STACK.length - 1];
  }

  function onError(callback) {
    const scope = getContext();

    if (!scope) {
      throw new Error('Cannot call onError() outside views');
    }

    scope.onError = callback;
  }

  function useState(fallback) {
    const scope = getContext();

    if (!scope) {
      throw new Error('Cannot call useState() outside views');
    }

    const key = scope.key;

    scope.key += 1;
    scope.val = scope.val || [];
    scope.val[key] = scope.val[key] || fallback;

    return [scope.val[key], v => {
      scope.val[key] = v;
      scope.sync();
    }];
  }

  function useEffect(callback, inputs) {
    const scope = getContext();

    if (!scope) {
      throw new Error('Cannot call useEffect() outside views');
    }

    const key = scope.fx;

    scope.fx += 1;
    scope.in = scope.in || [];
    scope.get = scope.get || [];

    const prev = scope.in[key];
    const enabled = inputs ? isDiff(prev, inputs) : true;

    scope.in[key] = inputs;
    scope.get[key] = scope.get[key] || {};

    Object.assign(scope.get[key], { cb: callback, on: enabled });
  }

  function createContext(tag, createView) {
    return (props, children) => {
      const scope = {
        sync: () => scope.set().then(() => {
          if (scope.get) {
            return Promise.all(scope.get.map(fx => {
              return Promise.resolve()
                .then(() => fx.on && isFunction(fx.off) && fx.off())
                .then(() => fx.on && fx.cb())
                .then(x => { fx.off = x; });
            }));
          }
        }).catch(e => {
          if (scope.onError) {
            scope.onError(e);
          } else {
            throw e;
          }
        }),
      };

      let length;
      return createView(() => {
        scope.key = 0;
        scope.fx = 0;

        push(scope);

        try {
          const retval = tag(props, children);

          if (!scope.length) {
            length = scope.key;
            scope.length = scope.key;
          } else if (length !== scope.key) {
            throw new Error('Calls to useState() must be predictable');
          }

          pop(scope);

          return retval;
        } catch (e) {
          throw new Error(`${tag.name || 'View'}: ${e.message}`);
        }
      }, sync => { scope.set = sync; });
    };
  }

  function getDecorated(Tag, state, actions, children) {
    if (typeof Tag === 'object') {
      const factory = Tag;

      Tag = (_state, _actions) => factory.render(_state, _actions, children);

      state = (typeof factory.state === 'function' && factory.state(state)) || state;
      actions = Object.keys(factory).reduce((memo, key) => {
        if (key !== 'state' && key !== 'render' && typeof factory[key] === 'function') {
          memo[key] = (...args) => factory[key](...args);
        }
        return memo;
      }, {});
    }

    let instance;
    if (
      typeof Tag === 'function'
      && (Tag.prototype && typeof Tag.prototype.render === 'function')
      && (Tag.constructor === Function && Tag.prototype.constructor !== Function)
    ) {
      instance = new Tag(state, children);

      Tag = _state => (instance.state = _state, instance.render()); // eslint-disable-line

      state = instance.state || state;
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

    if (typeof initialState === 'function') {
      refreshCallback = initialState;
      initialState = null;
    }

    const {
      Tag, state, actions, instance,
    } = getDecorated(Factory, initialState, userActions || {}, children);

    if (!instance && isFunction(Factory) && arguments.length === 1) {
      return createContext(Factory, createView);
    }

    return (el, cb = createElement, hook = refreshCallback) => {
      const data = clone(state || {});
      const fns = [];

      let childNode;
      let vnode;
      let $;

      function sync(result) {
        return Promise.all(fns.map(fn => fn(data, $)))
          .then(() => {
            updateElement(childNode, vnode, vnode = fixTree(Tag(data, $)), null, cb, null);
          })
          .then(() => result);
      }

      if (hook) {
        hook(payload => sync(Object.assign(data, payload)));
      }

      // decorate given actions
      $ = Object.keys(actions).reduce((memo, fn) => {
        const method = actions[fn];

        if (typeof method !== 'function') {
          throw new Error(`Invalid action, given ${method} (${fn})`);
        }

        memo[fn] = (...args) => {
          const retval = method(...args)(data, $);

          if (typeof retval === 'object' && typeof retval.then === 'function') {
            return retval.then(result => {
              if (result && !(isScalar(result) || isArray(result))) {
                return sync(Object.assign(data, result));
              }
              return result;
            });
          }

          if (retval && !(isScalar(retval) || isArray(retval))) {
            sync(Object.assign(data, retval));
          }

          return retval;
        };

        if (instance) {
          instance[fn] = memo[fn];
        }

        return memo;
      }, {});

      $.subscribe = fn => {
        Promise.resolve(fn(data, $)).then(() => fns.push(fn));

        return () => {
          fns.splice(fns.indexOf(fn), 1);
        };
      };

      $.unmount = _cb => destroyElement(childNode, _cb);

      Object.defineProperty($, 'state', {
        configurable: false,
        enumerable: true,
        get: () => data,
      });

      childNode = mountElement(el, vnode = fixTree(Tag(data, $)), cb);
      $.target = childNode;

      return $;
    };
  }

  function createThunk(vnode, cb = createElement) {
    const ctx = {
      refs: {},
      render: cb,
      source: null,
      vnode: vnode || ['div'],
      thunk: createView(() => ctx.vnode, null),
    };

    ctx.unmount = async _cb => {
      if (ctx.source) {
        await destroyElement(ctx.source.target, _cb);
      }
    };

    ctx.mount = async (el, _vnode) => {
      await ctx.unmount();

      ctx.vnode = _vnode || ctx.vnode;
      ctx.source = ctx.thunk(el, ctx.render);

      return ctx;
    };

    ctx.wrap = (tag, name) => (props, children) => {
      const identity = name || tag.name || 'Thunk';
      const target = document.createDocumentFragment();
      const thunk = tag(props, children)(target, ctx.render);

      ctx.refs[identity] = ctx.refs[identity] || [];
      ctx.refs[identity].push(thunk);

      const _remove = thunk.target.remove;

      thunk.target.remove = target.remove = _cb => Promise.resolve()
        .then(() => {
          ctx.refs[identity].splice(ctx.refs[identity].indexOf(thunk), 1);

          if (!ctx.refs[identity].length) {
            delete ctx.refs[identity];
          }
        })
        .then(() => _remove(_cb));

      return target;
    };

    return ctx;
  }

  function values(attrs, cb) {
    if (isUndef(attrs)) return [];
    if (!isObject(attrs)) return attrs;
    if (isArray(attrs)) return filter(attrs);

    return filter(Object.keys(attrs).reduce((prev, cur) => {
      if (!isUndef(attrs[cur])) prev.push(cb(attrs[cur], cur));

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
        el.teardown = () => Object.keys(el.events).map(x => el.removeEventListener(x, eventListener));
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

  const h = (name, attrs, ...children) => {
    return typeof attrs === 'object' ? [name, attrs, children] : [name, undefined, [attrs].concat(children)];
  };

  const pre = (vnode, svg, cb = createElement) => {
    return cb(['pre', { class: 'highlight' }, format(cb(vnode, svg).outerHTML)], svg);
  };

  const bind = (tag, ...hooks) => {
    const cbs = filter(hooks, isFunction);

    const mix = (...args) => {
      return cbs.reduce((prev, cb) => cb(...args) || prev, undefined);
    };

    return (...args) => (args.length <= 2 ? tag(args[0], args[1], mix) : mix(...args));
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

    onError,
    useState,
    useEffect,
  };

  function summarize(script) {
    const { innerHTML, parentNode } = script;

    const code = innerHTML
      .replace(/( +)appendChild\(([^;]*?)\);?/gm, '$1$2')
      .replace(/test\(\s*\([^=()]*\)\s*=>\s*\{/, '')
      .replace(/\}\)\s*;$/, '');

    mountElement(parentNode, ['details', [
      ['summary', 'View executed code'],
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
        appendChild(t.el, createElement(['div', { class: 'error' }, e.toString()]));
      }
    });

    window.hijs = '.highlight';

    mountElement('head', ['script', { src: '//cdn.rawgit.com/cloudhead/hijs/0eaa0031/hijs.js' }]);
  });

}());
