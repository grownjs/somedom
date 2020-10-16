import { isDiff, clone } from './util';
import { getContext } from './ctx';

export { createContext } from './ctx';

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

export function useRef(result) {
  return useMemo(() => {
    let value = clone(result);

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
