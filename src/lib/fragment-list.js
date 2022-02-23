/* eslint-disable no-plusplus, no-await-in-loop */

import { destroyElement } from './node';
import { raf, tick } from './util';

let effects = [];
export default class FragmentList {
  constructor(props, children, render, context) {
    props.key = props.key || `fragment-${Math.random().toString(36).substr(2)}`;

    this.target = document.createComment(`#${props.key}`);
    this.target.__update = async (_, prev, next) => {
      this.__ready = false;
      this.touch(next[1], next.slice(2));
      await tick();
      return _;
    };

    this.props = props;
    this.name = props.key;
    this.render = render;
    this.context = context;

    context.blocks = context.blocks || {};
    context.blocks[this.name] = context.blocks[this.name] || [];
    context.blocks[this.name].instance = this;

    if (props.mode && props.mode !== 'replace') {
      this.patch(children);
    }
  }

  prepend(vnode) { return this.sync(vnode, -1); }

  append(vnode) { return this.sync(vnode, 1); }

  update(vnode) { return this.sync(vnode); }

  touch(props, children) {
    Object.assign(this.props, props);
    return this.patch(children);
  }

  patch(children) {
    raf(async () => {
      if (this.mounted) {
        if (!this.__ready) {
          this.__ready = true;
          this.__frag = this.render(children);
          this.__frag.mount(this.root, this.target.nextSibling);
        } else if (this.__frag) {
          const rm = [];

          let old = this.target.nextSibling;
          while (this.__frag.length-- > 0) {
            if (!old) break;
            rm.push(old);
            old = old.nextSibling;
          }

          await Promise.all(rm.map(node => destroyElement(node)));

          const nextNode = this.render(children);

          this.__frag.length = nextNode.length;
          nextNode.mount(this.root, this.target.nextSibling || null);
        }
      }
    });
    return this;
  }

  mount(el, props, children) {
    return this.touch(props, children);
  }

  sync(children, direction) {
    if (!direction) {
      return this.touch(null, children);
    }

    if (this.mounted && this.__frag) {
      if (this.last && this.last !== direction) this.anchor = null;
      if (this.anchor && !this.root.contains(this.anchor)) {
        this.target = this.context.blocks[`#${this.name}`];
        this.anchor = null;
      }

      const frag = this.render(children);

      this.last = direction;
      this.__frag.length += frag.length;

      let anchor;
      if (direction < 0) {
        this.anchor = this.anchor || this.target.nextSibling;
        anchor = frag.childNodes[0];
        frag.mount(this.root, this.anchor);
        this.__frag.anchor = anchor;
      } else {
        const offset = this.__frag.offset + this.__frag.length;

        this.anchor = this.anchor || this.root.childNodes[offset - 1] || null;
        anchor = frag.childNodes[frag.childNodes.length - 1];
        frag.mount(this.root, this.anchor);
      }
      this.anchor = anchor;
    }
    return this;
  }

  get root() {
    return this.target
      && this.target.parentNode;
  }

  get mounted() {
    return this.root
      && this.root.isConnected
      && this.target.isConnected;
  }

  static from(props, children, render, context) {
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
        frag = FragmentList[name] = new FragmentList(props, children, render, context);
      } else {
        frag = FragmentList[name].touch(props, children);
      }
    }
    return frag;
  }

  static stop() {
    effects.forEach(fn => fn());
    effects = [];
  }

  static with(id, cb) {
    return FragmentList.for(id)
      .then(frag => {
        const fn = cb(frag);

        if (typeof fn === 'function') {
          effects.push(fn);
        }
        return frag;
      });
  }

  static has(id) {
    return (FragmentList[`#${id}`] && FragmentList[`#${id}`].mounted) || false;
  }

  static for(id) {
    return new Promise(ok => {
      if (!FragmentList.has(id)) {
        raf(() => ok(FragmentList.for(id)));
      } else {
        ok(FragmentList[`#${id}`]);
      }
    });
  }
}
