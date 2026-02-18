let currentEffect = null;
let batchDepth = 0;
let pendingEffects = new Set();

export function signal(initialValue, options) {
  let value = initialValue;
  const subscribers = new Set();

  const read = () => {
    if (currentEffect && !subscribers.has(currentEffect)) {
      subscribers.add(currentEffect);
      currentEffect._deps.add(subscribers);
    }
    return value;
  };

  const write = (newValue) => {
    if (value !== newValue) {
      value = newValue;
      const subs = [...subscribers];
      if (batchDepth > 0) {
        subs.forEach(fn => pendingEffects.add(fn));
      } else {
        subs.forEach(fn => fn());
      }
    }
  };

  const sig = {
    get value() { return read(); },
    set value(v) { write(v); },
    peek() { return value; },
    subscribe(fn) {
      if (subscribers.size === 0 && options?.onSubscribe) options.onSubscribe();
      subscribers.add(fn);
      return () => {
        subscribers.delete(fn);
        if (subscribers.size === 0 && options?.onUnsubscribe) options.onUnsubscribe();
      };
    },
  };

  return sig;
}

export function computed(fn) {
  let cachedValue;
  let dirty = true;
  const subscribers = new Set();
  let deps = [];

  const evaluate = () => {
    if (!dirty) return cachedValue;

    const prevEffect = currentEffect;
    currentEffect = run;

    deps.forEach(dep => dep.delete(run));
    deps = [];

    try {
      cachedValue = fn();
    } finally {
      currentEffect = prevEffect;
    }

    dirty = false;
    return cachedValue;
  };

  function run() {
    if (currentEffect && !subscribers.has(currentEffect)) {
      subscribers.add(currentEffect);
      currentEffect._deps.add(subscribers);
    }
    return evaluate();
  }

  const notify = () => {
    dirty = true;
    const subs = [...subscribers];
    if (batchDepth > 0) {
      subs.forEach(fn => pendingEffects.add(fn));
    } else {
      subs.forEach(fn => fn());
    }
  };

  run._deps = new Set();
  
  const originalEffect = currentEffect;
  currentEffect = run;
  try {
    cachedValue = fn();
  } finally {
    deps = [...run._deps];
    deps.forEach(dep => dep.add(notify));
    currentEffect = originalEffect;
  }
  dirty = false;

  return {
    get value() { return run(); },
    peek() {
      if (dirty) evaluate();
      return cachedValue;
    },
    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
  };
}

export function effect(fn) {
  let cleanup = null;
  let disposed = false;
  const deps = new Set();

  function run() {
    if (disposed) return;

    if (cleanup) {
      cleanup();
      cleanup = null;
    }

    deps.forEach(dep => dep.delete(run));
    deps.clear();

    const prevEffect = currentEffect;
    currentEffect = run;
    run._deps = deps;

    try {
      cleanup = fn();
    } finally {
      currentEffect = prevEffect;
    }
  }

  run._deps = deps;
  run();

  return function dispose() {
    disposed = true;
    if (cleanup) cleanup();
    deps.forEach(dep => dep.delete(run));
  };
}

export function batch(fn) {
  batchDepth++;
  try {
    fn();
  } finally {
    batchDepth--;
    if (batchDepth === 0 && pendingEffects.size > 0) {
      const effects = [...pendingEffects];
      pendingEffects.clear();
      effects.forEach(fn => fn());
    }
  }
}

export function untracked(fn) {
  const prev = currentEffect;
  currentEffect = null;
  try {
    return fn();
  } finally {
    currentEffect = prev;
  }
}
