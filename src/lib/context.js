import { getCurrentEffect } from './signals.js';

export function scope(defaultValue) {
  const subscribers = new Set();
  let value = defaultValue;

  const read = () => {
    const currentEffect = getCurrentEffect();
    if (currentEffect && !subscribers.has(currentEffect)) {
      subscribers.add(currentEffect);
      currentEffect._deps.add(subscribers);
    }
    return value;
  };

  const write = newValue => {
    if (value !== newValue) {
      value = newValue;
      const subs = [...subscribers];
      subs.forEach(cb => cb());
    }
  };

  const provide = (newValue, fn) => {
    const prev = value;
    value = newValue;
    try {
      return fn();
    } finally {
      value = prev;
    }
  };

  const sig = {
    get value() { return read(); },
    set value(v) { write(v); },
    peek() { return value; },
    provide,
    subscribe(cb) {
      subscribers.add(cb);
      return () => subscribers.delete(cb);
    },
  };

  return sig;
}
