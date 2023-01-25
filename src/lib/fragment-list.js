/* eslint-disable no-plusplus, no-await-in-loop */

import { createElement, upgradeElements } from './node';
import { updateProps } from './attrs';
import { isBlock, tick } from './util';

const CACHED_FRAGMENTS = new Map();

function __validate(children) {
  if (!isBlock(children)) {
    throw new Error(`Fragments should be lists of nodes, given '${JSON.stringify(children)}'`);
  }
}

let FRAGMENT_FX = [];
export default class FragmentList {
  constructor(props, children, callback = createElement) {
    if (props instanceof window.HTMLElement) {
      this.props = {};
      this.vnode = children;
      this.target = props;
      this.render = callback;
    } else {
      this.target = document.createElement(props.tag || 'x-fragment');

      delete props.tag;

      this.props = {};
      this.vnode = null;
      this.render = callback;
      this.touch(props, children);
    }

    this.target.__update = (_, prev, next) => {
      this.vnode = prev;
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
    __validate(children);
    updateProps(this.target, this.props, props, null, this.render);
    return this.patch(children);
  }

  async sync(children, direction) {
    __validate(children);
    if (!direction) await this.patch(children);
    if (this.mounted) {
      if (direction < 0) {
        this.vnode.unshift(...children);
      } else {
        this.vnode.push(...children);
      }

      const frag = this.render(children);
      if (direction < 0) {
        await frag.mount(this.target, this.target.firstChild);
      } else {
        await frag.mount(this.target);
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

  static async with(id, cb) {
    const frag = FragmentList.get(id);
    const fn = await cb(frag);

    if (typeof fn === 'function') {
      FRAGMENT_FX.push(fn);
    }
    return frag;
  }

  static from(props, children, callback) {
    let frag;
    if (typeof props === 'string') {
      frag = CACHED_FRAGMENTS.get(props);
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

  static del(id) {
    CACHED_FRAGMENTS.delete(id);
  }

  static has(id) {
    return CACHED_FRAGMENTS.has(id)
      && CACHED_FRAGMENTS.get(id).mounted;
  }

  static get(id) {
    return CACHED_FRAGMENTS.get(id);
  }
}
