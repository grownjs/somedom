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

  function assignProps(target, attrs, svg, cb) {
    Object.entries(attrs).forEach(([prop, val]) => {
      if (prop === 'key' || prop === 'open') return;
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

    if (changed) assignProps(target, props, svg, cb);
    return changed;
  }

  function destroyElement(target, wait = cb => cb()) {
    const rm = () => target && target.remove();

    return wait === false ? rm() : Promise.resolve().then(() => wait(rm));
  }

  function replaceElement(target, next, svg, cb) {
    if (isFunction(target.onreplace)) return target.onreplace(next, svg, cb);

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

      if (isNot(y)) {
        tasks.push({ rm: el });
        old = null;
      } else if (isNot(x)) {
        tasks.push({ add: y });
        off++;
      } else {
        tasks.push({ patch: x, with: y, target: el });
        off++;
      }
    }

    if (off !== target.childNodes.length) {
      for (let k = target.childNodes.length; k > off; k--) {
        tasks.push({ rm: target.childNodes[k] });
      }
    }

    for (const task of tasks) {
      if (task.rm) await destroyElement(task.rm);
      if (!isNot(task.add)) insertElement(target, task.add, svg, cb);
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

  var somedom = /*#__PURE__*/Object.freeze({
    __proto__: null,
    h: h,
    pre: pre,
    bind: bind,
    listeners: listeners,
    attributes: attributes,
    mount: mountElement,
    patch: updateElement,
    render: createElement,
    unmount: destroyElement,
    styles: applyStyles,
    classes: applyClasses,
    animation: applyAnimations,
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
    isTag: isTag,
    isNode: isNode,
    isEmpty: isEmpty,
    isBlock: isBlock,
    isEven: isEven,
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
