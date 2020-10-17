import { raf, isFunction } from './util';
import { SHARED_CONTEXT as context } from './shared';

export function pop(scope) {
  context[context.indexOf(scope)] = null;
}

export function push(scope) {
  context.push(scope);
}

export function getContext() {
  const scope = context[context.length - 1];

  if (!scope) {
    throw new Error('Cannot call getContext() outside views');
  }

  return scope;
}

export function createContext(tag, view) {
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

    const factory = view(() => {
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

    return (...args) => {
      const view$ = factory(...args);

      view$.subscribe(ctx => {
        Object.assign(ctx, { data: scope.val || [] });
      });

      return view$;
    };
  };
}
