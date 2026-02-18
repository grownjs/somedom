let currentEffect = null;
let batchDepth = 0;
const pendingEffects = new Set();

export function signal(initialValue, options) {
  let value = initialValue;
  const subscribers = new Set();

  const read = () => {
    if (currentEffect && !subscribers.has(currentEffect)) {
      const wasEmpty = subscribers.size === 0;
      subscribers.add(currentEffect);
      currentEffect._deps.add(subscribers);
      if (currentEffect._signals) {
        currentEffect._signals.add({ subscribers, options, wasEmpty });
      }
      if (wasEmpty && options?.onSubscribe) options.onSubscribe();
    }
    return value;
  };

  const write = newValue => {
    if (value !== newValue) {
      value = newValue;
      const subs = [...subscribers];
      if (batchDepth > 0) {
        subs.forEach(cb => pendingEffects.add(cb));
      } else {
        subs.forEach(cb => cb());
      }
    }
  };

  const sig = {
    get value() { return read(); },
    set value(v) { write(v); },
    peek() { return value; },
    subscribe(cb) {
      if (subscribers.size === 0 && options?.onSubscribe) options.onSubscribe();
      subscribers.add(cb);
      return () => {
        subscribers.delete(cb);
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
      subs.forEach(cb => pendingEffects.add(cb));
    } else {
      subs.forEach(cb => cb());
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
    subscribe(cb) {
      subscribers.add(cb);
      return () => subscribers.delete(cb);
    },
  };
}

export function effect(fn) {
  let cleanup = null;
  const disposed = false;
  const deps = new Set();
  const signals = new Set();

  function run() {
    if (disposed) return;

    if (cleanup) {
      cleanup();
      cleanup = null;
    }

    deps.forEach(dep => dep.delete(run));
    deps.clear();
    signals.forEach(sig => sig.subscribers.delete(run));
    signals.clear();

    const prevEffect = currentEffect;
    currentEffect = run;
    run._deps = deps;
    run._signals = signals;

    try {
      cleanup = fn();
    } finally {
      currentEffect = prevEffect;
    }
  }

  run._deps = deps;
  run._signals = signals;
  run();

  return function dispose() {
    if (cleanup) cleanup();
    deps.forEach(dep => dep.delete(run));
    signals.forEach(sig => {
      sig.subscribers.delete(run);
      if (sig.subscribers.size === 0 && sig.wasEmpty && sig.options?.onUnsubscribe) {
        sig.options.onUnsubscribe();
      }
    });
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
      effects.forEach(cb => cb());
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
