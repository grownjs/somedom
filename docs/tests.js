(function () {
  'use strict';

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

  function assert(vnode) {
    throw new Error(`Invalid vnode, given '${vnode}'`);
  }

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
        node.parentNode = this;
        this.childNodes[i] = node;
      }
    }

    appendChild(node) {
      this.childNodes.push(node);
    }

    get outerHTML() {
      return this.childNodes.map(node => node.outerHTML || node.nodeValue).join('');
    }
  }

  const isArray = value => Array.isArray(value);
  const isFunction = value => typeof value === 'function';
  const isSelector = value => value && ELEM_REGEX.test(value);
  const isUndef = value => typeof value === 'undefined' || value === null;
  const isObject = value => value !== null && (typeof value === 'function' || typeof value === 'object');
  const isScalar = value => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';

  const isDiff = (prev, next) => {
    if (isFunction(prev) || isFunction(next) || typeof prev !== typeof next) return true;
    if (isArray(prev)) {
      if (prev.length !== next.length) return true;

      for (let i = 0; i < next.length; i += 1) {
        if (isDiff(prev[i], next[i])) return true;
      }
    } else if (isObject(prev)) {
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
    if (isObject(value)) return Object.keys(value).length === 0;

    return typeof value === 'undefined' || value === '' || value === null || value === false;
  };

  const isNode = x => isArray(x) && x.length <= 3 && ((typeof x[0] === 'string' && isSelector(x[0])) || typeof x[0] === 'function');

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

  const format = value => {
    const xml = String(value)
      .replace(/^\s+|\s+$/g, '')
      .replace(/></g, '>\n<')
      .replace(/\/(\w+)></g, '/$1>\n<')
      .replace(/>(.+?)<([a-zA-Z])/g, '>\n$1\n<$2');

    const output = xml.split('\n');

    for (let i = 0, tabs = ''; i < output.length; i += 1) {
      const line = output[i].replace(/^\s+|\s+$/g, '');

      if (/^<[/]/.test(line)) {
        tabs = tabs.replace('  ', '');
        output[i] = tabs + line;
      } else if (/<.*>.*<\/.*>|<.*[^>]\/>/.test(line)) {
        output[i] = tabs + line;
      } else {
        output[i] = tabs + line;
        tabs += '  ';
      }
    }

    return output.join('\n');
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

  function findEqual(cur, list, i, c) {
    for (; i < c; i += 1) {
      if (!isDiff(cur, list[i])) return i;
    }
    return -1;
  }

  function sortedZip(prev, next, cb) {
    const length = Math.max(prev.length, next.length);

    for (let i = 0; i < length; i += 1) {
      const diff = isDiff(prev[i], next[i]);
      const offset = findEqual(prev[i], next, i, length);

      if (!diff || offset === -1) {
        if (!prev[i]) prev.shift();
      }

      if (isDiff(prev[i], next[i])) {
        cb(prev[i] || null, next[i] || null, i);
      }
    }
  }

  const apply = (cb, length, options = {}) => (...args) => length === args.length && cb(...args, options);
  const raf = cb => ((typeof window !== 'undefined' && window.requestAnimationFrame) || setTimeout)(cb);

  const replace = (target, node, i) => target.replaceChild(node, target.childNodes[i]);
  const remove = (target, node) => target && target.removeChild(node);

  const append = (target, node) => (node instanceof Fragment
    ? node.childNodes.map(sub => append(target, sub))
    : target.appendChild(node));

  const detach = (target, node) => {
    if (node) target.parentNode.insertBefore(node, target);
    remove(target.parentNode, target);
  };

  function fixTree(vnode) {
    if (!isNode(vnode)) {
      return isArray(vnode) ? vnode.map(fixTree) : vnode;
    }

    vnode = isNode(vnode) && isFunction(vnode[0])
      ? fixTree(vnode[0](vnode[1], toArray(vnode[2])))
      : vnode;

    if (isArray(vnode[2])) {
      vnode[2].forEach((sub, i) => {
        if (isNode(sub)) {
          vnode[2][i] = fixTree(sub);
        }
      });
    }

    return vnode;
  }

  function fixProps(vnode) {
    if (isScalar(vnode) || !isNode(vnode)) {
      return Array.isArray(vnode) ? vnode.map(fixProps) : vnode;
    }

    if (isArray(vnode[1]) || isScalar(vnode[1])) {
      vnode[2] = vnode[1];
      vnode[1] = null;
    }

    if (isFunction(vnode[0])) {
      return vnode;
    }

    if (!isNode(vnode)) assert(vnode);

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

    return [name, attrs, toArray(vnode[2])];
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
    if (isUndef(value)) assert(value);

    if (!isNode(value)) {
      return isArray(value)
        ? new Fragment(value, node => createElement(node, svg, cb))
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

  function createView(Factory, initialState, userActions = {}) {
    const children = isArray(userActions) ? userActions : undefined;

    const {
      Tag, state, actions, instance,
    } = getDecorated(Factory, initialState, userActions, children);

    return (el, cb = createElement) => {
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

      $.subscribe = fn => Promise.resolve(fn(data, $)).then(() => fns.push(fn));
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
      thunk: createView(() => ctx.vnode),
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

    ctx.wrap = (Target, props, children) => {
      return [() => {
        const target = document.createDocumentFragment();
        const thunk = new Target(props, children)(target, ctx.render);

        ctx.refs[Target.name] = ctx.refs[Target.name] || [];
        ctx.refs[Target.name].push(thunk);

        const _remove = thunk.target.remove;

        thunk.target.remove = target.remove = _cb => Promise.resolve()
          .then(() => {
            ctx.refs[Target.name].splice(ctx.refs[Target.name].indexOf(thunk), 1);

            if (!ctx.refs[Target.name].length) {
              delete ctx.refs[Target.name];
            }
          })
          .then(() => _remove(_cb));

        return target;
      }];
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
