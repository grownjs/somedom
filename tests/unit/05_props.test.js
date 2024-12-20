import * as td from 'testdouble';
import { test } from '@japa/runner';

import {
  values,
  styles,
  classes,
  datasets,
  nextProps,
  invokeProps,
  applyStyles,
  applyClasses,
  applyAnimations,
} from '../../src/lib/props.js';

import { tick } from '../../src/lib/util.js';
import doc from './fixtures/env.js';

let div;
function setup(t) {
  t.each.setup(() => {
    doc.enable();
    div = document.createElement('div');
  });

  t.each.teardown(() => {
    doc.disable();
    td.reset();
  });
}

test.group('values', t => {
  setup(t);

  const inspect = (v, k) => [k, v];

  test('should handle invalid values', ({ expect }) => {
    expect(values).not.toThrow();
    expect(values()).toEqual([]);
  });

  test('should skip non-objects', ({ expect }) => {
    expect(values('foo', inspect)).toEqual('foo');
  });

  test('should normalize given arrays', ({ expect }) => {
    expect(values(['foo', null], inspect)).toEqual(['foo']);
  });

  test('should normalize given objects', ({ expect }) => {
    expect(values({ foo: 1, bar: null }, inspect)).toEqual([
      ['foo', 1],
    ]);
  });
});

test.group('styles', t => {
  setup(t);

  test('should handle given styles', ({ expect }) => {
    expect(styles({ color: 'red' })).toEqual(['color: red']);
  });
});

test.group('classes', t => {
  setup(t);

  test('should handle given classes', ({ expect }) => {
    expect(classes({ enabled: 1, off: 0 })).toEqual(['enabled']);
  });
});

test.group('datasets', t => {
  setup(t);

  test('should handle given arrays as data-*', ({ expect }) => {
    datasets(div, 'test', ['x']);
    expect(div.outerHTML).toEqual('<div data-test="[&quot;x&quot;]"></div>');
  });

  test('should handle given objects as data-*', ({ expect }) => {
    datasets(div, 'test', { a: 'b' });
    expect(div.outerHTML).toEqual('<div data-test-a="b"></div>');
  });

  test('should handle nested objects as data-*', ({ expect }) => {
    datasets(div, 'test', { a: { b: 'c' } });
    expect(div.outerHTML).toEqual('<div data-test-a="{&quot;b&quot;:&quot;c&quot;}"></div>');
  });

  test('should keep given data-* as is', ({ expect }) => {
    datasets(div, 'data', { title: 'OK' });
    expect(div.outerHTML).toEqual('<div data-title="OK"></div>');
  });

  test('should skip given functions', ({ expect }) => {
    function foo() {}
    foo.bar = 'baz';
    datasets(div, 'data', foo);
    expect(div.outerHTML).toEqual('<div></div>');
  });
});

test.group('nextProps', t => {
  setup(t);

  test('will handle hooks for class-based animations', async ({ expect }) => {
    const run = nextProps(div, ['x', 'y']);

    td.replace(div.classList, 'add', td.func('addClass'));
    td.replace(div.classList, 'remove', td.func('removeClass'));

    setTimeout(() => div.dispatchEvent(new Event('animationend')), 10);

    await run();

    expect(td.explain(div.classList.add).callCount).toEqual(2);
    expect(td.explain(div.classList.remove).callCount).toEqual(2);
  });
});

test.group('invokeProps', t => {
  setup(t);

  test('will invoke helpers if is given as function', ({ expect }) => {
    const cb = td.func('helpers');

    invokeProps(div, 'key', ['value'], cb);

    expect(td.explain(cb).callCount).toEqual(1);
  });

  test('will invoke helper-props if is given as object', ({ expect }) => {
    const cb = {
      key: td.func('helpers'),
    };

    invokeProps(div, 'key', ['value'], cb);
    invokeProps(div, 'undef', ['value'], cb);

    expect(td.explain(cb.key).callCount).toEqual(1);
  });

  test('will fallback for datasets()', ({ expect }) => {
    invokeProps(div, 'key', ['value']);
    expect(div.outerHTML).toEqual('<div data-key="[&quot;value&quot;]"></div>');
  });

  test('will skip non-objects', ({ expect }) => {
    invokeProps(div, 'key', false);
    expect(div.outerHTML).toEqual('<div></div>');
  });
});

test.group('applyStyles', t => {
  setup(t);

  test('will call through styles()', ({ expect }) => {
    expect(applyStyles({ foo: 'bar' })).toEqual('foo: bar');
  });
});

test.group('applyClasses', t => {
  setup(t);

  test('will call through classes()', ({ expect }) => {
    expect(applyClasses(['foo'])).toEqual('foo');
  });
});

test.group('applyAnimations', t => {
  setup(t);

  test('will call nextProps() through hooks', async ({ expect }) => {
    applyAnimations(['test'], 'myHook', div);
    expect(typeof div.myHook).toEqual('function');

    td.replace(div.classList, 'add', td.func('addClass'));
    td.replace(div.classList, 'remove', td.func('removeClass'));

    setTimeout(() => div.dispatchEvent(new Event('animationend')), 10);

    await tick(() => div.myHook());

    expect(td.explain(div.classList.add).callCount).toEqual(1);
    expect(td.explain(div.classList.remove).callCount).toEqual(1);
  });
});
