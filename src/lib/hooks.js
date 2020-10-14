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
  scope.val[key] = scope.val[key] || fallback;

  return [scope.val[key], v => {
    scope.val[key] = v;
    raf(scope.sync);
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
    const scope = {
      sync: () => scope.set().then(() => {
        if (scope.get) {
          return Promise.all(scope.get.map(fx => {
            return Promise.resolve()
              .then(() => fx.on && isFunction(fx.off) && fx.off())
              .then(() => fx.on && fx.cb())
              .then(x => { fx.off = x; });
          }));
        }
      }).catch(e => {
        if (scope.onError) {
          scope.onError(e);
        } else {
          throw e;
        }
      }),
    };

    let length;
    return createView(() => {
      scope.key = 0;
      scope.fx = 0;
      scope.m = 0;

      push(scope);

      try {
        const retval = tag(props, children);

        if (!scope.length) {
          length = scope.key;
          scope.length = scope.key;
        } else if (length !== scope.key) {
          throw new Error('Calls to useState() must be predictable');
        }

        pop(scope);

        return retval;
      } catch (e) {
        throw new Error(`${tag.name || 'View'}: ${e.message}`);
      }
    }, sync => { scope.set = sync; });
  };
}
