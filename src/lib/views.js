import {
  createElement, destroyElement, updateElement, mountElement,
} from './node';

import { clone } from './util';
import { fixTree } from './attrs';

export function createView(tag, state, actions = {}) {
  return (el, cb = createElement) => {
    const data = clone(state || {});
    const fns = [];

    let childNode;
    let vnode;

    const $ = Object.keys(actions)
      .reduce((prev, cur) => {
        prev[cur] = (...args) => Promise.resolve()
          .then(() => actions[cur](...args)(data))
          .then(result => Object.assign(data, result))
          .then(() => Promise.all(fns.map(fn => fn(data))))
          .then(() => updateElement(childNode, vnode, vnode = fixTree(tag(data, $)), null, cb, null)); // eslint-disable-line

        return prev;
      }, {});

    childNode = mountElement(el, vnode = fixTree(tag(data, $)), cb);

    $.subscribe = fn => Promise.resolve(fn(data)).then(() => fns.push(fn));
    $.unmount = _cb => destroyElement(childNode, _cb);
    $.target = childNode;

    Object.defineProperty($, 'state', {
      configurable: false,
      enumerable: true,
      get: () => data,
    });

    return $;
  };
}

export function createThunk(vnode, cb = createElement) {
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

  ctx.wrap = (Target, _vnode) => {
    _vnode = _vnode || ['div'];

    let thunk;
    return [_vnode[0], {
      oncreate: ref => {
        thunk = new Target(_vnode[1] || {})(ref, ctx.render);

        ctx.refs[Target.name] = ctx.refs[Target.name] || [];
        ctx.refs[Target.name].push(thunk);
      },
      ondestroy: () => {
        ctx.refs[Target.name].splice(ctx.refs[Target.name].indexOf(thunk), 1);

        if (!ctx.refs[Target.name].length) {
          delete ctx.refs[Target.name];
        }
      },
    }];
  };

  return ctx;
}
