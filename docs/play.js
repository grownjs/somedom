(function () {
  'use strict';

  const RE_TAG_NAME = /^[0-9A-Za-z-]+$/;
  const RE_XML_SPLIT = /(>)(<)(\/*)/g;
  const RE_XML_CLOSE_END = /.+<\/\w[^>]*>$/;
  const RE_XML_CLOSE_BEGIN = /^<\/\w/;

  const XLINK_PREFIX = /^xlink:?/;
  const XLINK_NS = 'http://www.w3.org/1999/xlink';

  const EE_SUPPORTED = ['oncreate', 'onupdate', 'onreplace', 'ondestroy'];

  const CLOSE_TAGS = [
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

  const isArray = value => Array.isArray(value);
  const isString = value => typeof value === 'string';
  const isFunction = value => typeof value === 'function';
  const isNot = value => typeof value === 'undefined' || value === null;
  const isPlain = value => value !== null && Object.prototype.toString.call(value) === '[object Object]';
  const isObject = value => value !== null && (typeof value === 'function' || typeof value === 'object');
  const isScalar = value => isString(value) || typeof value === 'number' || typeof value === 'boolean';
  const isSignal = value => value !== null && typeof value === 'object' && 'value' in value && typeof value.peek === 'function';

  function isTag(value) {
    return RE_TAG_NAME.test(value);
  }

  function isNode(value) {
    if (isArray(value) && isFunction(value[0])) return true;
    if (!value || !(isArray(value) && isTag(value[0]))) return false;
    if (isPlain(value[1]) && value.length >= 2) return true;
    return false;
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

  function getKey(vnode) {
    if (isNode(vnode) && isPlain(vnode[1])) {
      return vnode[1].key;
    }
    return undefined;
  }

  function getKeyFromNode(node) {
    if (node.nodeType === 1) {
      return node.getAttribute('data-key') || undefined;
    }
    return undefined;
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

  function toFragment(vnode) {
    return vnode.slice(2);
  }

  function toArray(value) {
    if (isNode(value)) return value;
    if (!isArray(value)) return isEmpty(value) ? [] : [value];
    return value.reduce((memo, n) => memo.concat(isNode(n) ? [n] : toArray(n)), []);
  }

  function toAttrs(node) {
    if (node.attributes && !node.getAttributeNames) {
      return node.attributes;
    }
    return node.getAttributeNames().reduce((memo, key) => {
      memo[key.replace('data-', '@')] = node[key] || node.getAttribute(key);
      return memo;
    }, {});
  }

  function toNodes(node, children) {
    if (isNot(node)) return;
    if (isArray(node)) return node.map(x => toNodes(x, children));

    if (typeof NodeList !== 'undefined' && node instanceof NodeList) return toNodes(node.values(), children);

    if (node.nodeType === 3) return node.nodeValue;
    if (node.nodeType === 1) {
      const nodes = [];

      if (children) {
        node.childNodes.forEach(x => {
          nodes.push(toNodes(x, children));
        });
      }

      return [node.tagName.toLowerCase(), toAttrs(node), nodes];
    }

    if (node.childNodes) return node.childNodes.map(x => toNodes(x, children));

    return toNodes([...node], children);
  }

  class Fragment {
    constructor() {
      this.childNodes = [];
      this.nodeType = 11;
    }

    appendChild(node) {
      if (Fragment.valid(node)) {
        node.childNodes.forEach(sub => {
          this.appendChild(sub);
        });
      } else {
        this.childNodes.push(node);
      }
    }

    mount(target, node) {
      while (this.childNodes.length > 0) {
        const next = this.childNodes.shift();

        if (node) {
          target.insertBefore(next, node);
        } else {
          target.appendChild(next);
        }
      }
    }

    static valid(value) {
      return value instanceof Fragment;
    }

    static from(render, value) {
      const target = new Fragment();
      value = value.filter(_ => _ !== null);
      target.vnode = value;
      value.forEach(vnode => {
        target.appendChild(render(vnode));
      });
      return target;
    }
  }

  const camelCase = value => value.replace(/-([a-z])/g, (_, $1) => $1.toUpperCase());
  const dashCase = value => value.replace(/[A-Z]/g, '-$&').toLowerCase();
  const filter = (value, cb) => value.filter(cb || (x => !isEmpty(x)));

  function plain(target, re) {
    if (typeof target === 'object' && 'length' in target && !target.nodeType) return Array.from(target).map(x => plain(x, re));
    if (re && target.nodeType === 1) return target.outerHTML;
    if (target.nodeType === 3) return target.nodeValue;
    return Array.from(target.childNodes).map(x => plain(x, true));
  }

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

  function clone(value) {
    if (isArray(value)) return value.map(x => clone(x));
    if (value instanceof Date) return new Date(value.getTime());
    if (value instanceof RegExp) return new RegExp(value.source, value.flags);
    return Object.keys(value).reduce((memo, k) => Object.assign(memo, { [k]: clone(value[k]) }), {});
  }

  const apply = (cb, length, options = {}) => (...args) => length === args.length && cb(...args, options);
  const raf = cb => ((typeof window !== 'undefined' && window.requestAnimationFrame) || setTimeout)(cb);
  const tick = cb => Promise.resolve().then(cb).then(() => new Promise(done => raf(done)));

  const append = (target, node) => target.appendChild(node);
  const remove = (target, node) => target && target.removeChild(node);
  const replace = (target, node, i) => target.replaceChild(node, target.childNodes[i]);

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

  let currentEffect = null;
  let batchDepth = 0;
  const pendingEffects = new Set();

  function signal(initialValue, options) {
    let value = initialValue;
    const subscribers = new Set();

    const read = () => {
      if (currentEffect && !subscribers.has(currentEffect)) {
        const wasEmpty = subscribers.size === 0;
        subscribers.add(currentEffect);
        currentEffect._deps.add(subscribers);
        if (currentEffect._signals) {
          currentEffect._signals.add({ subscribers, options, wasEmpty });
        }
        if (wasEmpty && options?.onSubscribe) options.onSubscribe();
      }
      return value;
    };

    const write = newValue => {
      if (value !== newValue) {
        value = newValue;
        const subs = [...subscribers];
        if (batchDepth > 0) {
          subs.forEach(cb => pendingEffects.add(cb));
        } else {
          subs.forEach(cb => cb());
        }
      }
    };

    const sig = {
      get value() { return read(); },
      set value(v) { write(v); },
      peek() { return value; },
      subscribe(cb) {
        if (subscribers.size === 0 && options?.onSubscribe) options.onSubscribe();
        subscribers.add(cb);
        return () => {
          subscribers.delete(cb);
          if (subscribers.size === 0 && options?.onUnsubscribe) options.onUnsubscribe();
        };
      },
    };

    return sig;
  }

  function computed(fn) {
    let cachedValue;
    let dirty = true;
    const subscribers = new Set();
    let deps = [];

    const evaluate = () => {
      if (!dirty) return cachedValue;

      const prevEffect = currentEffect;
      currentEffect = run;

      deps.forEach(dep => dep.delete(run));
      deps = [];

      try {
        cachedValue = fn();
      } finally {
        currentEffect = prevEffect;
      }

      dirty = false;
      return cachedValue;
    };

    function run() {
      if (currentEffect && !subscribers.has(currentEffect)) {
        subscribers.add(currentEffect);
        currentEffect._deps.add(subscribers);
      }
      return evaluate();
    }

    const notify = () => {
      dirty = true;
      const subs = [...subscribers];
      if (batchDepth > 0) {
        subs.forEach(cb => pendingEffects.add(cb));
      } else {
        subs.forEach(cb => cb());
      }
    };

    run._deps = new Set();

    const originalEffect = currentEffect;
    currentEffect = run;
    try {
      cachedValue = fn();
    } finally {
      deps = [...run._deps];
      deps.forEach(dep => dep.add(notify));
      currentEffect = originalEffect;
    }
    dirty = false;

    return {
      get value() { return run(); },
      peek() {
        if (dirty) evaluate();
        return cachedValue;
      },
      subscribe(cb) {
        subscribers.add(cb);
        return () => subscribers.delete(cb);
      },
    };
  }

  function effect(fn) {
    let cleanup = null;
    const deps = new Set();
    const signals = new Set();

    function run() {

      if (typeof cleanup === 'function') {
        cleanup();
        cleanup = null;
      }

      deps.forEach(dep => dep.delete(run));
      deps.clear();
      signals.forEach(sig => sig.subscribers.delete(run));
      signals.clear();

      const prevEffect = currentEffect;
      currentEffect = run;
      run._deps = deps;
      run._signals = signals;

      try {
        cleanup = fn();
      } finally {
        currentEffect = prevEffect;
      }
    }

    run._deps = deps;
    run._signals = signals;
    run();

    return function dispose() {
      if (typeof cleanup === 'function') cleanup();
      deps.forEach(dep => dep.delete(run));
      signals.forEach(sig => {
        sig.subscribers.delete(run);
        if (sig.subscribers.size === 0 && sig.wasEmpty && sig.options?.onUnsubscribe) {
          sig.options.onUnsubscribe();
        }
      });
    };
  }

  function batch(fn) {
    batchDepth++;
    try {
      fn();
    } finally {
      batchDepth--;
      if (batchDepth === 0 && pendingEffects.size > 0) {
        const effects = [...pendingEffects];
        pendingEffects.clear();
        effects.forEach(cb => cb());
      }
    }
  }

  function untracked(fn) {
    const prev = currentEffect;
    currentEffect = null;
    try {
      return fn();
    } finally {
      currentEffect = prev;
    }
  }

  const SIGNAL_PREFIX = 'signal:';
  const DIRECTIVE_PREFIX = 'd:';

  function isSignalProp(prop) {
    return prop.indexOf(SIGNAL_PREFIX) === 0;
  }

  function isDirective(prop) {
    return prop.indexOf(DIRECTIVE_PREFIX) === 0;
  }

  function bindDirective(target, prop, val) {
    const directive = prop.slice(DIRECTIVE_PREFIX.length);

    if (!target._directiveDisposers) {
      target._directiveDisposers = new Map();
    }

    if (target._directiveDisposers.has(prop)) {
      target._directiveDisposers.get(prop)();
    }

    let dispose;

    switch (directive) {
      case 'show':
        dispose = effect(() => {
          target.style.display = val.value ? '' : 'none';
        });
        break;

      case 'hide':
        dispose = effect(() => {
          target.style.display = val.value ? 'none' : '';
        });
        break;

      case 'class': {
        const className = val.className || 'active';
        dispose = effect(() => {
          target.classList.toggle(className, !!val.value);
        });
        break;
      }

      case 'model': {
        const field = val;
        const input = target;
        input.value = field.value;

        const handler = () => {
          field.value = input.value;
        };

        input.addEventListener('input', handler);

        dispose = effect(() => {
          if (document.activeElement !== input) {
            input.value = field.value;
          }
        });

        dispose._cleanup = () => {
          input.removeEventListener('input', handler);
        };
        break;
      }

      case 'text':
        dispose = effect(() => {
          target.textContent = val.value;
        });
        break;

      case 'html':
        dispose = effect(() => {
          target.innerHTML = val.value;
        });
        break;

      case 'click-outside': {
        const callback = val;
        const handler = e => {
          if (!target.contains(e.target)) {
            callback(e);
          }
        };
        document.addEventListener('click', handler);
        dispose = () => document.removeEventListener('click', handler);
        break;
      }

      default:
        return;
    }

    target._directiveDisposers.set(prop, dispose);
  }

  function cleanupDirectives(target) {
    if (target._directiveDisposers) {
      target._directiveDisposers.forEach(dispose => {
        if (dispose._cleanup) dispose._cleanup();
        dispose();
      });
      target._directiveDisposers.clear();
    }
  }

  function bindSignalProp(target, prop, signal) {
    const domProp = prop.slice(SIGNAL_PREFIX.length);

    if (!target._signalDisposers) {
      target._signalDisposers = new Map();
    }

    if (target._signalDisposers.has(prop)) {
      target._signalDisposers.get(prop)();
    }

    const dispose = effect(() => {
      const value = signal.value;
      if (domProp === 'textContent') {
        target.textContent = value == null ? '' : String(value);
      } else if (domProp === 'innerHTML') {
        target.innerHTML = value == null ? '' : String(value);
      } else if (domProp.startsWith('style.')) {
        target.style[domProp.slice(6)] = value;
      } else {
        target[domProp] = value;
      }
    });

    target._signalDisposers.set(prop, dispose);
  }

  function cleanupSignalProps(target) {
    if (target._signalDisposers) {
      target._signalDisposers.forEach(dispose => dispose());
      target._signalDisposers.clear();
    }
  }

  function assignProps(target, attrs, svg, cb) {
    Object.entries(attrs).forEach(([prop, val]) => {
      if (prop === 'key' || prop === 'open') return;
      if (prop === 'ref') {
        target.oncreate = el => {
          val.current = el;
        };
      } else if (prop === '@html') {
        target.innerHTML = val;
      } else if (isSignalProp(prop)) {
        if (val && typeof val === 'object' && 'value' in val) {
          bindSignalProp(target, prop, val);
          const originalTeardown = target.teardown;
          target.teardown = () => {
            cleanupSignalProps(target);
            if (originalTeardown) originalTeardown();
          };
        }
      } else if (isDirective(prop)) {
        if (val && typeof val === 'object' && 'value' in val) {
          bindDirective(target, prop, val);
          const originalTeardown = target.teardown;
          target.teardown = () => {
            cleanupDirectives(target);
            if (originalTeardown) originalTeardown();
          };
        }
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

        if (isSignal(val)) {
          bindSignalProp(target, `signal:${name}`, val);
          const originalTeardown = target.teardown;
          target.teardown = () => {
            cleanupSignalProps(target);
            if (originalTeardown) originalTeardown();
          };
          return;
        }

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
          return;
        }

        if (removed) target.removeAttribute(name);
        else if (isScalar(value)) target.setAttribute(name, value);
      }
    });
  }

  function updateProps(target, prev, next, svg, cb) {
    const keys = Object.keys(prev).concat(Object.keys(next));

    let changed;
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

    if (changed) {
      Object.keys(prev).forEach(k => {
        if (isSignalProp(k) && !(k in next)) {
          if (target._signalDisposers && target._signalDisposers.has(k)) {
            target._signalDisposers.get(k)();
            target._signalDisposers.delete(k);
          }
        }
        if (isDirective(k) && !(k in next)) {
          if (target._directiveDisposers && target._directiveDisposers.has(k)) {
            const dispose = target._directiveDisposers.get(k);
            if (dispose._cleanup) dispose._cleanup();
            dispose();
            target._directiveDisposers.delete(k);
          }
        }
      });
      assignProps(target, props, svg, cb);
    }
    return changed;
  }

  class Portal {
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

  function createSignalTextNode(signal) {
    const textNode = document.createTextNode(String(signal.peek()));

    const dispose = effect(() => {
      textNode.nodeValue = String(signal.value);
    });

    textNode._signalDispose = dispose;
    return textNode;
  }

  const canMove = () => typeof Element !== 'undefined' && 'moveBefore' in Element.prototype;

  function destroyElement(target, wait = cb => cb()) {
    const rm = () => target && target.remove();

    return wait === false ? rm() : Promise.resolve().then(() => wait(rm));
  }

  function replaceElement(target, next, svg, cb) {
    if (isFunction(target.onreplace)) return target.onreplace(next, svg, cb);

    const newNode = createElement(next, svg, cb);

    if (Portal.valid(newNode)) {
      newNode.mount();
      target.remove();
    } else if (Fragment.valid(newNode)) {
      detach(target, newNode);
    } else {
      target.replaceWith(newNode);
    }
    return newNode;
  }

  function insertElement(target, next, svg, cb) {
    const newNode = createElement(next, svg, cb);

    if (Portal.valid(newNode)) {
      newNode.mount();
    } else if (Fragment.valid(newNode)) {
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
      if (isSignal(vnode)) {
        return createSignalTextNode(vnode);
      }
      return (isScalar(vnode) && document.createTextNode(String(vnode))) || vnode;
    }

    if (!isArray(vnode)) {
      return vnode;
    }

    if (cb && cb.tags && cb.tags[vnode[0]]) {
      return createElement(cb.tags[vnode[0]](vnode[1], toFragment(vnode), cb), svg, cb);
    }

    if (!isNode(vnode)) {
      return Fragment.from(v => createElement(v, svg, cb), vnode);
    }

    if (isFunction(vnode[0])) {
      return createElement(vnode[0](vnode[1], vnode.slice(2)), svg, cb);
    }

    if (vnode[0] === 'portal') {
      const [, props, ...children] = vnode;
      return Portal.from(v => createElement(v, svg, cb), children, props.target);
    }

    const isSvg = svg || vnode[0].indexOf('svg') === 0;
    const [tag, props, ...children] = vnode;

    let el = isSvg
      ? document.createElementNS('http://www.w3.org/2000/svg', tag)
      : document.createElement(tag);

    if (props && props.key) {
      el.setAttribute('data-key', props.key);
    }

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

    const childNodes = el.childNodes;
    if (childNodes.length > 0) {
      const originalTeardown = el.teardown;
      el.teardown = () => {
        for (let i = 0; i < childNodes.length; i++) {
          const child = childNodes[i];
          if (child._signalDispose) {
            child._signalDispose();
          }
        }
        if (originalTeardown) originalTeardown();
      };
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

    if (isBlock(view)) {
      view.forEach(node => {
        mountElement(target, node, svg, cb);
      });
    } else if (!isNot(view)) {
      target = insertElement(target, view, svg, cb);
    }
    return target;
  }

  async function upgradeNode(target, prev, next, svg, cb) {
    if (isScalar(next) || (!isNode(prev) || prev[0] !== next[0] || target.nodeType !== 1)) {
      return replaceElement(target, next, svg, cb);
    }

    if (updateProps(target, prev[1] || [], next[1] || [], svg, cb)) {
      if (isFunction(target.onupdate)) await target.onupdate(target);
      if (isFunction(target.update)) await target.update();
    }

    return next[1] && next[1]['@html']
      ? target : updateElement(target, toFragment(prev), toFragment(next), svg, cb);
  }

  async function upgradeElements(target, vnode, svg, cb) {
    const tasks = [];
    const next = toArray(vnode);
    const c = Math.max(target.childNodes.length, next.length);

    const oldChildren = Array.from(target.childNodes);
    const oldByKey = new Map();
    const usedKeys = new Set();

    for (let i = 0; i < oldChildren.length; i++) {
      const key = getKeyFromNode(oldChildren[i]);
      if (key) {
        oldByKey.set(key, { el: oldChildren[i], index: i });
      }
    }

    let off = 0;
    let old;
    let el;
    let x;
    for (let i = 0; i < c; i += 1) {
      if (old !== off) {
        el = target.childNodes[off];
        x = toNodes(el);
        old = off;
      }

      const y = next.shift();
      const yKey = getKey(y);

      if (isNot(y)) {
        tasks.push({ rm: el });
        old = null;
      } else if (isNot(x)) {
        if (yKey && oldByKey.has(yKey) && !usedKeys.has(yKey)) {
          const oldEl = oldByKey.get(yKey).el;
          const oldIdx = oldByKey.get(yKey).index;
          usedKeys.add(yKey);
          if (oldIdx < off) {
            tasks.push({ move: oldEl, target: el });
            off++;
          } else {
            tasks.push({ patch: toNodes(oldEl), with: y, target: oldEl });
            usedKeys.add(yKey);
          }
        } else {
          tasks.push({ add: y });
          off++;
        }
      } else {
        const xKey = getKeyFromNode(el);
        if (yKey && yKey === xKey && !usedKeys.has(yKey)) {
          tasks.push({ patch: x, with: y, target: el });
          usedKeys.add(yKey);
          off++;
        } else if (yKey && oldByKey.has(yKey) && !usedKeys.has(yKey)) {
          const oldEl = oldByKey.get(yKey).el;
          tasks.push({ move: oldEl, target: el });
          usedKeys.add(yKey);
          off++;
        } else {
          tasks.push({ patch: x, with: y, target: el });
          off++;
        }
      }
    }

    if (off !== target.childNodes.length) {
      for (let k = target.childNodes.length; k > off; k--) {
        const child = target.childNodes[k - 1];
        const key = getKeyFromNode(child);
        if (!key || !usedKeys.has(key)) {
          tasks.push({ rm: child });
        }
      }
    }

    for (const task of tasks) {
      if (task.rm) await destroyElement(task.rm);
      if (!isNot(task.add)) insertElement(target, task.add, svg, cb);
      if (task.move) {
        if (canMove()) {
          target.moveBefore(task.move, task.target);
        } else {
          target.insertBefore(task.move, task.target);
        }
      }
      if (!isNot(task.patch)) await patchNode(task.target, task.patch, task.with, svg, cb);
    }
  }

  async function updateElement(target, prev, next, svg, cb) {
    if (!prev || (isNode(prev) && isNode(next))) {
      return upgradeNode(target, prev, next, svg, cb);
    }

    if (isNode(prev)) {
      while (isArray(next) && next.length === 1) next = next[0];
      return updateElement(target, [prev], next, svg, cb);
    }

    if (isNode(next)) {
      return upgradeNode(target, prev, next, svg, cb);
    }

    await upgradeElements(target, [next], svg, cb);
    return target;
  }

  async function patchNode(target, prev, next, svg, cb) {
    if (Fragment.valid(next)) {
      let anchor = target;
      while (next.childNodes.length > 0) {
        const node = next.childNodes.pop();

        target.parentNode.insertBefore(node, anchor);
        anchor = node;
      }

      detach(target);
      return anchor;
    }

    if (target.nodeType === 3 && isScalar(next)) {
      if (isDiff(prev, next)) {
        target.nodeValue = String(next);
      }
    } else {
      target = await upgradeNode(target, prev, next, svg, cb);
    }
    return target;
  }

  function eventListener(type) {
    return e => e.currentTarget.events[type](e);
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
      el.listeners = el.listeners || {};
      el.events = el.events || {};

      if (!el.teardown) {
        el.teardown = () => {
          Object.keys(el.events).forEach(x => {
            el.removeEventListener(x, el.listeners[x]);
            el.events[x] = [];
          });
        };
      }

      if (name.substr(0, 2) === 'on' && EE_SUPPORTED.indexOf(name) === -1) {
        const type = name.substr(2);

        if (!el.events[type]) {
          el.listeners[type] = eventListener(type);
          el.addEventListener(type, el.listeners[type], false);
        }

        el.events[type] = e => invokeEvent(e, name, value, globals);
      } else {
        (EE_SUPPORTED.indexOf(name) > -1 ? el : el.events)[name] = value;
      }
    }
  }

  const h = (tag = 'div', attrs = null, ...children) => {
    if (isScalar(attrs)) return [tag, {}, [attrs].concat(children).filter(x => !isNot(x))];
    if (isArray(attrs) && !children.length) return [tag, {}, attrs];
    return [tag, attrs || {}, children];
  };

  const portal = (target, ...children) => {
    return ['portal', { target }, children];
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

    cb.tags = mix.tags = Object.assign({},
      ...filter(hooks, x => isArray(x) || isPlain(x))
        .reduce((memo, cur) => memo.concat(cur), []).filter(isPlain));

    return cb;
  };

  const listeners = opts => apply(addEvents, 3, opts);
  const attributes = opts => apply(invokeProps, 3, opts);

  const text = (strings, ...values) => {
    let needsComputed = false;

    for (const val of values) {
      if (isSignal(val)) {
        needsComputed = true;
        break;
      }
    }

    if (!needsComputed) {
      return strings.reduce((result, str, i) => {
        return result + str + (i < values.length ? values[i] : '');
      }, '');
    }

    return computed(() => {
      return strings.reduce((result, str, i) => {
        const val = i < values.length ? values[i] : '';
        const value = isSignal(val) ? val.value : val;
        return result + str + (value != null ? value : '');
      }, '');
    });
  };

  var somedom = /*#__PURE__*/Object.freeze({
    __proto__: null,
    h: h,
    portal: portal,
    pre: pre,
    bind: bind,
    listeners: listeners,
    attributes: attributes,
    text: text,
    mount: mountElement,
    patch: updateElement,
    render: createElement,
    unmount: destroyElement,
    styles: applyStyles,
    classes: applyClasses,
    animation: applyAnimations,
    Portal: Portal,
    signal: signal,
    computed: computed,
    effect: effect,
    batch: batch,
    untracked: untracked,
    camelCase: camelCase,
    dashCase: dashCase,
    filter: filter,
    plain: plain,
    format: format,
    trim: trim,
    clone: clone,
    apply: apply,
    raf: raf,
    tick: tick,
    append: append,
    remove: remove,
    replace: replace,
    detach: detach,
    RE_TAG_NAME: RE_TAG_NAME,
    RE_XML_SPLIT: RE_XML_SPLIT,
    RE_XML_CLOSE_END: RE_XML_CLOSE_END,
    RE_XML_CLOSE_BEGIN: RE_XML_CLOSE_BEGIN,
    XLINK_PREFIX: XLINK_PREFIX,
    XLINK_NS: XLINK_NS,
    EE_SUPPORTED: EE_SUPPORTED,
    CLOSE_TAGS: CLOSE_TAGS,
    isArray: isArray,
    isString: isString,
    isFunction: isFunction,
    isNot: isNot,
    isPlain: isPlain,
    isObject: isObject,
    isScalar: isScalar,
    isSignal: isSignal,
    isTag: isTag,
    isNode: isNode,
    isEmpty: isEmpty,
    isBlock: isBlock,
    isEven: isEven,
    getKey: getKey,
    getKeyFromNode: getKeyFromNode,
    isDiff: isDiff,
    toFragment: toFragment,
    toArray: toArray,
    toAttrs: toAttrs,
    toNodes: toNodes
  });

  function summarize(script) {
    const { innerHTML, parentNode } = script;

    const code = innerHTML
      .replace(/( +)appendChild\(([^;]*?)\);?/gm, '$1$2')
      .replace(/test\(\s*\([^=()]*\)\s*=>\s*\{/, '')
      .replace(/\}\)\s*;$/, '');

    mountElement(parentNode, ['details', {}, [
      ['summary', {}, ['View executed code']],
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

    mountElement('head', ['script', {
      src: '//cdn.rawgit.com/cloudhead/hijs/0eaa0031/hijs.js',
    }]);
  });

})();
