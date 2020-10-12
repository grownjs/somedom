import {
  createElement, destroyElement, updateElement, mountElement,
} from './node';

import {
  getMethods, isFunction, isScalar, isArray, clone,
} from './util';

import { fixTree } from './attrs';
import { createContext } from './hooks';

export function getDecorated(Tag, state, actions, children) {
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

export function createView(Factory, initialState, userActions, refreshCallback) {
  const children = isArray(userActions) ? userActions : undefined;

  if (typeof initialState === 'function') {
    refreshCallback = initialState;
    initialState = null;
  }

  const {
    Tag, state, actions, instance,
  } = getDecorated(Factory, initialState, userActions || {}, children);

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
          updateElement(childNode, vnode, vnode = fixTree(Tag(data, $)), null, cb, null);
        })
        .then(() => result);
    }

    if (hook) {
      hook(payload => sync(Object.assign(data, payload)));
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

    return $;
  };
}

export function createThunk(vnode, cb = createElement) {
  const ctx = {
    refs: {},
    render: cb,
    source: null,
    vnode: vnode || ['div'],
    thunk: createView(() => ctx.vnode, null),
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
