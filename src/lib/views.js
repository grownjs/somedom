import {
  createElement, destroyElement, updateElement, mountElement,
} from './node';

import {
  getMethods, isFunction, isObject, isPlain, isArray, clone,
} from './util';

import {
  SKIP_METHODS,
} from './shared';

import Fragment from './fragment';

import { fixTree } from './attrs';
import { createContext } from './ctx';

export function getDecorated(Tag, state, actions, children) {
  if (isPlain(Tag) && isFunction(Tag.render)) {
    const factory = Tag;

    Tag = (_state, _actions) => factory.render(_state, _actions, children);

    state = isFunction(factory.state) ? factory.state(state) : factory.state || state;
    actions = Object.keys(factory).reduce((memo, key) => {
      if (!SKIP_METHODS.includes(key) && isFunction(factory[key])) {
        memo[key] = (...args) => factory[key](...args);
      }
      return memo;
    }, {});
  }

  let instance;
  if (
    isFunction(Tag)
    && (Tag.prototype && isFunction(Tag.prototype.render))
    && (Tag.constructor === Function && Tag.prototype.constructor !== Function)
  ) {
    instance = new Tag(state, children);
    instance.props = clone(state || {});

    Tag = _state => (instance.state = _state, instance.render()); // eslint-disable-line

    state = isFunction(instance.state) ? instance.state(state) : instance.state || state;
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

export function createView(Factory, initialState, userActions, refreshCallback) {
  const children = isArray(userActions) ? userActions : undefined;

  userActions = isPlain(userActions) ? userActions : {};

  if (isFunction(initialState)) {
    refreshCallback = initialState;
    initialState = null;
  }

  const {
    Tag, state, actions, instance,
  } = getDecorated(Factory, initialState, userActions, children);

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
          updateElement(childNode, vnode, vnode = fixTree(Tag(data, $)), null, cb);
        })
        .then(() => result);
    }

    if (hook) {
      hook(payload => sync(Object.assign(data, payload)));
    }

    // decorate given actions
    $ = Object.keys(actions).reduce((memo, fn) => {
      const method = actions[fn];

      if (!isFunction(method)) {
        throw new Error(`Invalid action, given ${method} (${fn})`);
      }

      memo[fn] = (...args) => {
        const retval = method(...args)(data, $);

        if (isObject(retval) && isFunction(retval.then)) {
          return retval.then(result => {
            if (isPlain(result)) {
              return sync(Object.assign(data, result));
            }
            return result;
          });
        }

        if (isPlain(retval)) {
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

    if (instance) {
      $.instance = instance;
    }

    return $;
  };
}

export function createThunk(vnode, cb = createElement) {
  const ctx = {
    refs: {},
    render: cb,
    source: null,
    vnode: vnode || ['div', null],
    thunk: createView(() => ctx.vnode, null),
  };

  ctx.unmount = async _cb => {
    const tasks = [];

    Object.keys(ctx.refs).forEach(ref => {
      ctx.refs[ref].forEach(thunk => {
        tasks.push(thunk.target.remove());
      });
    });

    await Promise.all(tasks);

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

  ctx.wrap = (tag, name) => {
    if (!isFunction(tag)) throw new Error(`Expecting a view factory, given '${tag}'`);

    return (props, children) => {
      const identity = name || tag.name || 'Thunk';
      const target = new Fragment();
      const thunk = tag(props, children)(target, ctx.render);

      ctx.refs[identity] = ctx.refs[identity] || [];
      ctx.refs[identity].push(thunk);

      const _remove = thunk.target.remove;

      thunk.target.remove = target.remove = async _cb => {
        ctx.refs[identity].splice(ctx.refs[identity].indexOf(thunk), 1);

        if (!ctx.refs[identity].length) {
          delete ctx.refs[identity];
        }

        return _remove(_cb);
      };

      return target;
    };
  };

  return ctx;
}
