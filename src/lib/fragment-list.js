/* eslint-disable no-plusplus, no-await-in-loop */

import { createElement, upgradeElements } from './node';
import { raf, tick, isBlock } from './util';
import { BEGIN } from './fragment';

let FRAGMENT_FX = [];
export default class FragmentList {
  constructor(props, children, callback = createElement) {
    props.key = props.key || `fragment-${Math.random().toString(36).substr(2)}`;

    this.target = document.createComment(`#${props.key}/${children.length}`);
    this.target.__update = (_, prev, next) => {
      this.vnode = prev || this.vnode;
      this.patch(next);
    };

    this.target.__length = children.length;
    this.target.__mark = BEGIN;

    this.props = props;
    this.vnode = children;
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
    const ok = this.mounted;

    raf(() => {
      const i = this.offset + 1;
      const c = this.length;

      if (ok && this.root.childNodes.length >= i + c) {
        this.target.__length = children.length;
        this.target.nodeValue = `#${this.props.key}/${children.length}`;
        this.__defer = upgradeElements(this.root, this.vnode, this.vnode = children, null, this.render, i, c);
      } else {
        const frag = this.render(children);
        const anchor = this.target.nextSibling;

        this.target.__length = frag.length;
        this.target.nodeValue = `#${this.props.key}/${frag.length}`;
        frag.childNodes.forEach(sub => this.root.insertBefore(sub, anchor));
      }
    });
    return this;
  }

  touch(props, children) {
    Object.assign(this.props, props);
    return children ? this.patch(children) : this;
  }

  sync(children, direction) {
    if (!isBlock(children)) {
      throw new Error(`Fragments should be lists of nodes, given '${JSON.stringify(children)}'`);
    }

    if (!direction) return this.patch(children);
    if (this.mounted) {
      const offset = this.offset + this.length;
      const begin = this.target;
      const end = this.root.childNodes[offset];

      if (direction < 0) {
        this.vnode.unshift(...children);
      } else {
        this.vnode.push(...children);
      }

      const frag = this.render(children);

      let anchor = direction < 0 ? begin : end;
      frag.childNodes.forEach(node => {
        this.root.insertBefore(node, anchor ? anchor.nextSibling : null);
        this.target.__length += 1;
        anchor = node;
      });

      this.target.nodeValue = `#${this.props.key}/${this.target.__length}`;
    }
    return this;
  }

  get root() {
    return this.target
      && this.target.parentNode;
  }

  get length() {
    return this.target.__length;
  }

  get offset() {
    const d = this.root.childNodes;
    const c = d.length;

    let i = 0;
    for (; i < c; i += 1) {
      if (d[i] === this.target) {
        return i;
      }
    }
    return -1;
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
      const name = `#${props.key}`;

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
