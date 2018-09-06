import { isFunction, isObject } from './util';

export const EE_SUPPORTED = ['oncreate', 'onupdate', 'ondestroy'];

export function eventListener(e) {
  return e.currentTarget.events[e.type](e);
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
    el.events = el.events || {};

    if (!el.teardown) {
      el.teardown = () => Object.keys(el.events).map(x => el.removeEventListener(x, eventListener));
    }

    if (name.substr(0, 2) === 'on' && EE_SUPPORTED.indexOf(name) === -1) {
      const type = name.substr(2);

      if (!el.events[type]) el.addEventListener(type, eventListener, false);

      el.events[type] = e => invokeEvent(e, name, value, globals);
    } else {
      (EE_SUPPORTED.indexOf(name) > -1 ? el : el.events)[name] = value;
    }
  }
}
