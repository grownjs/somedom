import * as td from 'testdouble';
import { test } from '@japa/runner';

import {
  assignProps, updateProps,
} from '../../src/lib/attrs.js';

import doc from './fixtures/env.js';

test.group('assignProps', t => {
  t.each.teardown(doc.disable);
  t.each.setup(doc.enable);

  let div;
  t.each.setup(() => {
    div = document.createElement('div');
  });

  test('should keep empty attributes', ({ expect }) => {
    assignProps(div, { foo: '' });
    expect(div.getAttribute('foo')).toEqual('');
  });

  test('should append given attributes', ({ expect }) => {
    assignProps(div, { foo: 'bar' });
    expect(div.getAttribute('foo')).toEqual('bar');
  });

  test('should skip special attributes, like key', ({ expect }) => {
    assignProps(div, { key: 'bar' });
    expect(div.getAttribute('key')).toBeNull();
  });

  test('should pass special attributes to given callback', ({ expect }) => {
    const spy = td.func('callback');

    assignProps(div, { baz: ['buzz'] }, null, spy);
    expect(td.explain(spy).callCount).toEqual(1);
  });

  test('should handle boolean attributes as expected', ({ expect }) => {
    assignProps(div, { test: true });
    expect(div.getAttribute('test')).toEqual('test');
  });

  test('should handle attributes from svg-elements too', ({ expect }) => {
    const svg = document.createElementNS('xmlns', 'svg');

    assignProps(svg, { 'xlink:href': 'z' }, true);
    expect(svg.getAttribute('href')).toEqual('z');
  });

  test('should remove attributes on falsy values', ({ expect }) => {
    div.setAttribute('foo', 'bar');
    div.setAttribute('hrez', 'baz');

    assignProps(div, {
      foo: false,
      'xlink:href': null,
      notFalsy: 0,
      emptyValue: '',
    }, true);

    expect(div.getAttribute('foo')).toEqual(null);
    expect(div.getAttribute('href')).toEqual(null);
    expect(div.getAttribute('notFalsy')).toEqual('0');
    expect(div.getAttribute('emptyValue')).toEqual('');
  });

  test('should handle the @html prop', ({ expect }) => {
    assignProps(div, { '@html': '<b>OSOM</b>' }, true);

    expect(div.outerHTML).toEqual('<div><b>OSOM</b></div>');
  });

  test('should skip :static props', ({ expect }) => {
    assignProps(div, { ':disabled': true }, true);

    expect(div.outerHTML).not.toContain(' disabled');
  });

  test('should handle class/style directives', ({ expect }) => {
    assignProps(div, {
      'style:backgroundColor': 'red',
      'style:font-size': '12px',
      'class:enabled': 1,
      'class:disabled': null,
    });

    expect(div.outerHTML).toContain(' class="enabled"');
    expect(div.outerHTML).toContain(' style="background-color: red; font-size: 12px;"');
  });
});

test.group('updateProps', t => {
  t.each.teardown(doc.disable);
  t.each.setup(doc.enable);

  let div;
  t.each.setup(() => {
    div = document.createElement('div');
  });

  test('should update changed values only', ({ expect }) => {
    div.setAttribute('a', 'b');
    div.setAttribute('foo', 'bar');
    div.setAttribute('href', 'baz');

    const attrs = { ...div.attributes };

    updateProps(div, attrs, { foo: 'BAR', a: 'b' });
    expect(div.getAttribute('foo')).toEqual('BAR');
    expect(div.getAttribute('a')).toEqual('b');
  });

  test('should assign new props', ({ expect }) => {
    updateProps(div, {}, { class: 'red' });
    expect(div.getAttribute('class')).toEqual('red');
  });
});
