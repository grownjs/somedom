/* eslint-disable no-plusplus, no-await-in-loop */

import { createElement, upgradeElements } from './node';
import { updateProps } from './attrs';
import { raf, tick, isBlock } from './util';

let FRAGMENT_FX = [];
export default class FragmentList {
  constructor(props, children, callback = createElement) {
    props.key = props.key || `fragment-${Math.random().toString(36).substr(2)}`;

    this.target = document.createElement('fragment');
    this.target.__update = (_, prev, next) => {
      this.vnode = prev || this.vnode;
      this.patch(next);
    };

    this.props = {};
    this.vnode = null;
    this.render = callback;
    this.touch(props, children);

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
      frag = FragmentList[`#${props}`];
    } else if (props['@html']) {
      const doc = document.createDocumentFragment();
      const div = document.createElement('div');

      div.innerHTML = props['@html'];
      [].slice.call(div.childNodes).forEach(node => {
        doc.appendChild(node);
      });
      return { target: doc };
    } else {
      const name = `#${props.key || props.name}`;

      if (!FragmentList[name]) {
        frag = FragmentList[name] = new FragmentList(props, children, callback);
      } else {
        frag = FragmentList[name].touch(props, children);
      }
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

  static has(id) {
    return FragmentList[`#${id}`]
      && FragmentList[`#${id}`].mounted;
  }

  static for(id, retries = 0) {
    return new Promise(ok => {
      if (retries++ > 100) {
        throw new ReferenceError(`Fragment not found, given '${id}'`);
      }

      if (!FragmentList.has(id)) {
        raf(() => ok(FragmentList.for(id, retries + 1)));
      } else {
        ok(FragmentList[`#${id}`]);
      }
    });
  }
}
