import {
  dashCase, isFunction, isObject, isScalar, isArray, isUndef, filter, raf,
} from './util';

export function values(attrs, cb) {
  if (isUndef(attrs)) return [];
  if (!isObject(attrs)) return attrs;
  if (isArray(attrs)) return filter(attrs);

  return filter(Object.keys(attrs).reduce((prev, cur) => {
    if (!isUndef(attrs[cur])) prev.push(cb(attrs[cur], cur));

    return prev;
  }, []));
}

export function styles(props) {
  return values(props, (v, k) => `${dashCase(k)}: ${v}`, '; ');
}

export function classes(props) {
  return values(props, (v, k) => (v ? k : undefined));
}

export function datasets(el, name, props) {
  if (isArray(props)) {
    el.setAttribute(`data-${name}`, JSON.stringify(props));
  } else {
    Object.keys(props).forEach(key => {
      const value = !isScalar(props[key])
        ? JSON.stringify(props[key])
        : props[key];

      el.setAttribute(`${name !== 'data' ? 'data-' : ''}${name}-${key}`, value);
    });
  }
}

export function nextProps(el, type, names) {
  return () => new Promise(resolve => {
    let t;

    function onEnd() {
      el.removeEventListener('animationend', onEnd);

      names.map(x => el.classList.remove(x));

      clearTimeout(t);
      resolve();
    }

    t = setTimeout(onEnd, 500);

    el.addEventListener('animationend', onEnd);

    raf(() => { names.map(x => el.classList.add(x)); });
  });
}

export function invokeProps(el, name, value, helpers) {
  if (isObject(helpers)) {
    if (isFunction(helpers)) return helpers(value, name, el);
    if (isFunction(helpers[name])) return helpers[name](value, name, el);
  }

  if (isObject(value)) datasets(el, name, value);
}

export const applyStyles = value => styles(value).join('; ');
export const applyClasses = value => classes(value).join(' ');
export const applyAnimations = (value, name, el) => { el[name] = nextProps(el, name, classes(value)); };
