import * as td from 'testdouble';
import { test } from '@japa/runner';

import {
  raf, clone, apply, filter, dashCase, replace, remove, append, detach,
} from '../../src/lib/util.js';

import {
  isNot, isArray, isFunction, isObject, isScalar, isNode, isEmpty, toArray, isDiff,
} from '../../src/lib/shared.js';

import doc from './fixtures/env.js';

test.group('clone', () => {
  test('should copy most common values', ({ expect }) => {
    const a = [{ d: new Date() }, { r: /x/ }];
    const b = clone(a);

    a[0].d.setTime(0);

    expect(a).not.toStrictEqual(b);
  });
});

test.group('apply', () => {
  const opts = {};
  const cbTag = td.func('tag');
  const cbAttrs = td.func('attrs');

  const callTag = apply(cbTag, 1, opts);
  const callAttrs = apply(cbAttrs, 2, opts);

  test('should skip invalid arguments length', ({ expect }) => {
    callTag();
    callAttrs();

    expect(td.explain(cbTag).callCount).toEqual(0);
    expect(td.explain(cbAttrs).callCount).toEqual(0);
  });

  test('should match given arguments length exactly', ({ expect }) => {
    td.when(cbTag(1, opts)).thenReturn('OK');
    td.when(cbAttrs(1, 2, opts)).thenReturn('OK');

    expect(callTag(1)).toEqual('OK');
    expect(callAttrs(1, 2)).toEqual('OK');

    expect(td.explain(cbTag).callCount).toEqual(1);
    expect(td.explain(cbAttrs).callCount).toEqual(1);
  });
});

test.group('filter', () => {
  test('should remove any falsy values', ({ expect }) => {
    expect(filter).toThrow();
    expect(filter([])).toEqual([]);
    expect(filter([0, 1, 2])).toEqual([0, 1, 2]);
    expect(filter([null, false, true, undefined])).toEqual([true]);
  });
});

test.group('isNot', () => {
  test('should assert for undefined or null values', ({ expect }) => {
    expect(isNot).not.toThrow();
    expect(isNot()).toBeTruthy();
    expect(isNot(0)).toBeFalsy();
    expect(isNot(NaN)).toBeFalsy();
    expect(isNot([])).toBeFalsy();
    expect(isNot({})).toBeFalsy();
    expect(isNot(false)).toBeFalsy();
    expect(isNot('')).toBeFalsy();
    expect(isNot(Infinity)).toBeFalsy();
    expect(isNot(undefined)).toBeTruthy();
  });
});

test.group('isArray', () => {
  test('should call Array.isArray', ({ expect }) => {
    expect(isArray).not.toThrow();
    expect(isArray(1)).toBeFalsy();
  });
});

test.group('isFunction', () => {
  test('should validate given functions', ({ expect }) => {
    expect(isFunction).not.toThrow();
    expect(isFunction(1)).toBeFalsy();
  });
});

test.group('isObject', () => {
  test('should validate given objects/functions', ({ expect }) => {
    expect(isObject).not.toThrow();
    expect(isObject(1)).toBeFalsy();
    expect(isObject({})).toBeTruthy();
    expect(isObject([])).toBeTruthy();
  });
});

test.group('isScalar', () => {
  test('should validate given scalars', ({ expect }) => {
    expect(isScalar).not.toThrow();
    expect(isScalar(1)).toBeTruthy();
    expect(isScalar({})).toBeFalsy();
    expect(isScalar(null)).toBeFalsy();
  });
});

test.group('isNode', () => {
  test('should validate given vnodes', ({ expect }) => {
    expect(isNode).not.toThrow();
    expect(isNode(1)).toBeFalsy();
    expect(isNode({})).toBeFalsy();
    expect(isNode([])).toBeFalsy();
    expect(isNode([''])).toBeFalsy();
    expect(isNode(['x'])).toBeFalsy();
    expect(isNode(['x', 'y'])).toBeFalsy();
    expect(isNode(['x', 'y', 'z'])).toBeFalsy();
    expect(isNode(['x', ['y', 'z']])).toBeFalsy();
    expect(isNode(['a', null, null, 'x'])).toBeFalsy();
    expect(isNode(['a', undefined])).toBeFalsy();
    expect(isNode(['a', null])).toBeFalsy();
    expect(isNode(['a', {}])).toBeTruthy();
    expect(isNode([Function])).toBeTruthy();
  });
});

test.group('isEmpty', () => {
  test('should validate empty values', ({ expect }) => {
    expect(isEmpty).not.toThrow();
    expect(isEmpty()).toBeTruthy();
    expect(isEmpty(1)).toBeFalsy();
    expect(isEmpty(0)).toBeFalsy();
    expect(isEmpty('')).toBeFalsy();
    expect(isEmpty([])).toBeTruthy();
    expect(isEmpty({})).toBeTruthy();
    expect(isEmpty(Function)).toBeFalsy();
  });
});

test.group('isDiff', () => {
  test('should compare two given values', ({ expect }) => {
    expect(isDiff).not.toThrow();
    expect(isDiff()).not.toBeTruthy();
    expect(isDiff(1, '1')).toBeTruthy();
    expect(isDiff(['foo'], ['foo'])).not.toBeTruthy();
    expect(isDiff(['foo'], ['bar'])).toBeTruthy();
    expect(isDiff(['foo'], ['foo', 'bar'])).toBeTruthy();
    expect(isDiff({ a: 'b' }, { a: 'b' })).not.toBeTruthy();
    expect(isDiff({ a: 'b' }, { c: 'd' })).toBeTruthy();
    expect(isDiff({ a: 'b' }, { a: 'B' })).toBeTruthy();
    expect(isDiff({ a: 'b' }, { a: 'b', c: 'd' })).toBeTruthy();
  });
});

test.group('dashCase', () => {
  test('should convert fromCamelCase -> to-dash-case', ({ expect }) => {
    expect(dashCase).toThrow();
    expect(dashCase('aBC')).toEqual('a-b-c');
  });
});

test.group('toArray', () => {
  test('should normalize given values as arrays', ({ expect }) => {
    expect(toArray).not.toThrow();
    expect(toArray([1])).toEqual([1]);
    expect(toArray(1)).toEqual([1]);
    expect(toArray(0)).toEqual([0]);
    expect(toArray(null)).toEqual([]);
    expect(toArray(false)).toEqual([]);
    expect(toArray(undefined)).toEqual([]);
  });
});

test.group('raf', () => {
  test('will invoke window.requestAnimationFrame or setTimeout', async ({ expect }) => {
    const a = td.func('raf');
    const b = td.func('cb');

    global.window = {
      requestAnimationFrame: a,
    };

    td.when(a(b))
      .thenReturn(42);

    expect(raf(b)).toEqual(42);

    delete global.window;

    expect(td.explain(a).callCount).toEqual(1);
    expect(td.explain(b).callCount).toEqual(0);

    raf(b);

    await new Promise(ok => setTimeout(ok));

    expect(td.explain(b).callCount).toEqual(1);
  });
});

test.group('DOM smoke-test', t => {
  t.each.teardown(doc.disable);
  t.each.setup(doc.enable);
  t.each.setup(() => {
    a = document.createElement('a');
    b = document.createElement('b');
    c = document.createElement('c');

    a.appendChild(b);
  });

  let a;
  let b;
  let c;

  test('test initial nodes', ({ expect }) => {
    expect(a.outerHTML).toEqual('<a><b></b></a>');
  });

  test('should replace childNodes', ({ expect }) => {
    replace(a, c, 0);
    expect(a.outerHTML).toEqual('<a><c></c></a>');
  });

  test('should remove childNodes', ({ expect }) => {
    remove(a, b);
    expect(a.outerHTML).toEqual('<a></a>');
  });

  test('should append childNodes', ({ expect }) => {
    append(a, c);
    expect(a.outerHTML).toEqual('<a><b></b><c></c></a>');
  });

  test('should detach childNodes', ({ expect }) => {
    const x = document.createElement('x');
    detach(b, x);
    expect(a.outerHTML).toEqual('<a><x></x></a>');
  });
});
