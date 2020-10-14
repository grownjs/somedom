import { isDiff, isFunction } from './util';
import { CTX } from './shared';

export function onError(callback) {
  const scope = CTX[CTX.length - 1];

  if (!scope) {
    throw new Error('Cannot call onError() outside views');
  }

  scope.onError = callback;
}

export function useState(fallback) {
  const scope = CTX[CTX.length - 1];

  if (!scope) {
    throw new Error('Cannot call useState() outside views');
  }

  const key = scope.key;

  scope.key += 1;
  scope[key] = scope[key] || fallback;

  return [scope[key], v => {
    scope[key] = v;
    scope.sync();
  }];
}

export function useEffect(callback, inputs) {
  const scope = CTX[CTX.length - 1];

  if (!scope) {
    throw new Error('Cannot call useEffect() outside views');
  }

  const [run] = useState({ in: inputs, cb: callback });

  run.on = inputs ? isDiff(run.in, inputs) : true;
  run.in = inputs;

  scope.fx.push(run);
}

export function createContext(tag, createView) {
  return (props, children) => {
    const key = CTX.length - 1;
    const scope = Object.assign([], {
      sync: () => scope.set().then(() => {
        if (scope.fx) {
          return Promise.all(scope.fx.map(x => {
            return Promise.resolve()
              .then(() => x.on && isFunction(x.off) && x.off())
              .then(() => x.on && x.cb())
              .then(y => { x.off = y; });
          }));
        }
      }).catch(e => {
        if (scope.onError) {
          scope.onError(e);
        } else {
          throw e;
        }
      }),
    });

    let length;
    return createView(() => {
      CTX.push(scope);

      scope.key = 1;
      scope.fx = [];

      try {
        const retval = tag(props, children);

        if (!scope[0]) {
          CTX.splice(key, 1);
          length = scope.key;
          scope[0] = scope.length;
        } else if (length !== scope.key) {
          throw new Error('Calls to useState() must be predictable');
        }

        return retval;
      } catch (e) {
        throw new Error(`${tag.name}: ${e.message}`);
      }
    }, sync => { scope.set = sync; });
  };
}
