import { EE_SUPPORTED, isFunction, isObject } from './shared.js';

export function eventListener(type) {
  return e => e.currentTarget.events[type](e);
}

export function invokeEvent(e, name, value, globals) {
  let skip;
  if (isObject(globals)) {
    if (isFunction(globals)) {
      skip = globals(name, e) === false;
    } else if (isFunction(globals[name])) {
      skip = globals[name](e) === false;
    }
  }

  if (!skip) value(e);
}

export function addEvents(el, name, value, globals) {
  if (isFunction(value)) {
    el.listeners = el.listeners || {};
    el.events = el.events || {};

    if (!el.teardown) {
      el.teardown = () => {
        Object.keys(el.events).forEach(x => {
          el.removeEventListener(x, el.listeners[x]);
          el.events[x] = [];
        });
      };
    }

    if (name.substr(0, 2) === 'on' && EE_SUPPORTED.indexOf(name) === -1) {
      const type = name.substr(2);

      if (!el.events[type]) {
        el.listeners[type] = eventListener(type);
        el.addEventListener(type, el.listeners[type], false);
      }

      el.events[type] = e => invokeEvent(e, name, value, globals);
    } else {
      (EE_SUPPORTED.indexOf(name) > -1 ? el : el.events)[name] = value;
    }
  }
}
