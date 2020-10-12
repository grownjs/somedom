import { isDiff } from './util';
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
  scope.val = scope.val || [];
  scope.val[key] = scope.val[key] || fallback;

  return [scope.val[key], v => {
    scope.val[key] = v;
    scope.sync();
  }];
}

export function useEffect(callback, inputs) {
  const scope = CTX[CTX.length - 1];

  if (!scope) {
    throw new Error('Cannot call useEffect() outside views');
  }

  scope.in = scope.in || [];
  scope.fx = scope.fx || [];

  const key = scope.fx.length;
  const prev = scope.in[key];
  const enabled = inputs ? isDiff(prev, inputs) : true;

  scope.in[key] = inputs;
  scope.fx.push({ callback, enabled });
}

export function createContext(tag, createView) {
  return (props, children) => {
    const key = CTX.length - 1;
    const scope = {
      sync: () => scope.set().then(() => {
        if (scope.fx) {
          return Promise.all(scope.fx.map(x => x.enabled && x.callback()));
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
      CTX.push(scope);

      scope.key = 0;
      scope.fx = [];

      try {
        const retval = tag(props, children);

        if (!scope.attached) {
          CTX.splice(key, 1);
          length = scope.key;
          scope.attached = true;
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
