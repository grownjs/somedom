import { raf, isDiff, isFunction } from './util';
import { pop, push, getContext } from './ctx';

export function onError(callback) {
  getContext().onError = callback;
}

export function useMemo(callback, inputs) {
  const scope = getContext();
  const key = scope.m;

  scope.m += 1;
  scope.v = scope.v || [];
  scope.d = scope.d || [];

  const prev = scope.d[key];

  if (!prev || isDiff(prev, inputs)) {
    scope.v[key] = callback();
    scope.d[key] = inputs;
  }

  return scope.v[key];
}

export function useRef() {
  return useMemo(() => {
    let value;

    return Object.defineProperty({}, 'current', {
      configurable: false,
      enumerable: true,
      set: ref => { value = ref; },
      get: () => value,
    });
  }, []);
}

export function useState(fallback) {
  const scope = getContext();
  const key = scope.key;

  scope.key += 1;
  scope.val = scope.val || [];

  if (typeof scope.val[key] === 'undefined') {
    scope.val[key] = fallback;
  }

  return [scope.val[key], v => {
    scope.val[key] = v;
    scope.sync();
  }];
}

export function useEffect(callback, inputs) {
  const scope = getContext();
  const key = scope.fx;

  scope.fx += 1;
  scope.in = scope.in || [];
  scope.get = scope.get || [];

  const prev = scope.in[key];
  const enabled = inputs ? isDiff(prev, inputs) : true;

  scope.in[key] = inputs;
  scope.get[key] = scope.get[key] || {};

  Object.assign(scope.get[key], { cb: callback, on: enabled });
}

export function createContext(tag, createView) {
  return (props, children) => {
    let deferred;

    const scope = {};

    function end(skip) {
      return scope.get.reduce((prev, fx) => {
        return prev.then(() => fx.off && fx.off())
          .then(() => !skip && fx.on && fx.cb())
          .then(x => {
            if (isFunction(x)) fx.off = x;
          });
      }, Promise.resolve());
    }

    function next(promise) {
      return promise.catch(e => {
        if (scope.get) raf(() => end(true));
        if (scope.onError) {
          scope.onError(e);
        } else {
          throw e;
        }
      }).then(() => {
        deferred = null;
      });
    }

    function after() {
      if (!scope.get) return;
      if (deferred) return deferred.then(after);
      deferred = next(end());
    }

    scope.sync = () => Promise.resolve().then(() => {
      if (deferred) return deferred.then(scope.sync);
      deferred = next(scope.set());
    });

    return createView(() => {
      scope.key = 0;
      scope.fx = 0;
      scope.m = 0;

      push(scope);

      try {
        const retval = tag(props, children);
        const key = [scope.key, scope.fx, scope.m].join('.');

        if (!scope.hash) {
          scope.hash = key;
        } else if (scope.hash !== key) {
          throw new Error('Hooks must be called in a predictable way');
        }

        return retval;
      } catch (e) {
        throw new Error(`${tag.name || 'View'}: ${e.message}`);
      } finally {
        pop(scope);
        after();
      }
    }, sync => { scope.set = sync; });
  };
}
