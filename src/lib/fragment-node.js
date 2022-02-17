import { destroyElement } from './node';
import { raf } from './util';

let effects = [];
export default class FragmentNode {
  constructor(props, children, render, context) {
    this.target = document.createComment(`#${props.key}`);
    this.props = props;
    this.name = props.key;
    this.render = render;
    this.context = context;

    context.blocks = context.blocks || {};
    context.blocks[this.name] = context.blocks[this.name] || [];
    context.blocks[this.name].instance = this;

    this.patch(children);
  }

  prepend(vnode) { return this.sync(vnode, -1); }

  append(vnode) { return this.sync(vnode, 1); }

  update(vnode) { return this.sync(vnode); }

  mount(props, children) {
    Object.assign(this.props, props);

    if (this.mounted && this.vnode) {
      this.vnode.children.forEach(node => {
        if (node && node !== this.target) destroyElement(node, false);
      });
      this.anchor = null;
    }

    return this.patch(children);
  }

  patch(children) {
    this._ready = false;

    setTimeout(() => {
      if (this.mounted) {
        this.vnode = this.render(children);
        this.vnode.mount(this.root, this.target.nextSibling);
        this._ready = Date.now();
      }
    });
    return this;
  }

  sync(children, direction) {
    if (!direction) {
      return this.mount(null, children);
    }

    if (this.mounted) {
      if (this.last && this.last !== direction) this.anchor = null;
      if (this.anchor && !this.root.contains(this.anchor)) {
        this.target = this.context.blocks[`#${this.name}`];
        this.anchor = null;
      }

      const frag = this.render(children);

      this.last = direction;
      this.vnode.length += frag.length;

      try {
        let anchor;
        if (direction < 0) {
          this.anchor = this.anchor || this.vnode.anchor;
          anchor = frag.childNodes[0];
          frag.mount(this.root, this.anchor);
          this.vnode.anchor = anchor;
        } else {
          const offset = Math.min(this.vnode.offset + this.vnode.length, this.root.childNodes.length);

          this.anchor = this.anchor || this.root.childNodes[offset - 1];
          anchor = frag.childNodes[frag.childNodes.length - 1];
          frag.mount(this.root, this.anchor);
        }
        this.anchor = anchor;
      } catch (e) {
        console.log('E_SYNC', e);
      }
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
      frag = FragmentNode[`#${props}`];
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

      if (!FragmentNode[name]) {
        frag = FragmentNode[name] = new FragmentNode(props, children, render, context);
      } else {
        frag = FragmentNode[name].mount(props, children);
      }
    }
    return frag;
  }

  static stop() {
    effects.forEach(fn => fn());
    effects = [];
  }

  static with(id, cb) {
    return FragmentNode.for(id).then(frag => {
      const fn = cb(frag);

      if (typeof fn === 'function') {
        effects.push(fn);
      }
      return frag;
    });
  }

  static has(id) {
    return FragmentNode[`#${id}`] && FragmentNode[`#${id}`].vnode;
  }

  static for(id) {
    return new Promise(ok => {
      if (!FragmentNode.has(id)) {
        raf(() => ok(FragmentNode.for(id)));
      } else {
        ok(FragmentNode[`#${id}`]);
      }
    });
  }
}
