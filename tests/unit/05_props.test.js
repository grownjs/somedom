import * as td from 'testdouble';
import { expect } from 'chai';
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

/* global beforeEach, afterEach, describe, it */

describe('props', () => {
  let div;

  beforeEach(() => {
    doc.enable();
    div = document.createElement('div');
  });

  afterEach(() => {
    doc.disable();
    td.reset();
  });

  describe('values', () => {
    const inspect = (v, k) => [k, v];

    it('should handle invalid values', () => {
      expect(values).not.to.throw();
      expect(values()).to.eql([]);
    });

    it('should skip non-objects', () => {
      expect(values('foo', inspect)).to.eql('foo');
    });

    it('should normalize given arrays', () => {
      expect(values(['foo', null], inspect)).to.eql(['foo']);
    });

    it('should normalize given objects', () => {
      expect(values({ foo: 1, bar: null }, inspect)).to.eql([
        ['foo', 1],
      ]);
    });
  });

  describe('styles', () => {
    it('should handle given styles', () => {
      expect(styles({ color: 'red' })).to.eql(['color: red']);
    });
  });

  describe('classes', () => {
    it('should handle given classes', () => {
      expect(classes({ enabled: 1, off: 0 })).to.eql(['enabled']);
    });
  });

  describe('datasets', () => {
    it('should handle given arrays as data-*', () => {
      datasets(div, 'test', ['x']);
      expect(div.outerHTML).to.eql('<div data-test="[&quot;x&quot;]"></div>');
    });

    it('should handle given objects as data-*', () => {
      datasets(div, 'test', { a: 'b' });
      expect(div.outerHTML).to.eql('<div data-test-a="b"></div>');
    });

    it('should handle nested objects as data-*', () => {
      datasets(div, 'test', { a: { b: 'c' } });
      expect(div.outerHTML).to.eql('<div data-test-a="{&quot;b&quot;:&quot;c&quot;}"></div>');
    });

    it('should keep given data-* as is', () => {
      datasets(div, 'data', { title: 'OK' });
      expect(div.outerHTML).to.eql('<div data-title="OK"></div>');
    });

    it('should skip given functions', () => {
      function foo() {}
      foo.bar = 'baz';
      datasets(div, 'data', foo);
      expect(div.outerHTML).to.eql('<div></div>');
    });
  });

  describe('nextProps', () => {
    it('will handle hooks for class-based animations', async () => {
      const run = nextProps(div, ['x', 'y']);

      td.replace(div.classList, 'add', td.func('addClass'));
      td.replace(div.classList, 'remove', td.func('removeClass'));

      setTimeout(() => div.dispatchEvent(new Event('animationend')), 10);

      await run();

      expect(td.explain(div.classList.add).callCount).to.eql(2);
      expect(td.explain(div.classList.remove).callCount).to.eql(2);
    });
  });

  describe('invokeProps', () => {
    it('will invoke helpers if is given as function', () => {
      const cb = td.func('helpers');

      invokeProps(div, 'key', ['value'], cb);

      expect(td.explain(cb).callCount).to.eql(1);
    });

    it('will invoke helper-props if is given as object', () => {
      const cb = {
        key: td.func('helpers'),
      };

      invokeProps(div, 'key', ['value'], cb);
      invokeProps(div, 'undef', ['value'], cb);

      expect(td.explain(cb.key).callCount).to.eql(1);
    });

    it('will fallback for datasets()', () => {
      invokeProps(div, 'key', ['value']);
      expect(div.outerHTML).to.eql('<div data-key="[&quot;value&quot;]"></div>');
    });

    it('will skip non-objects', () => {
      invokeProps(div, 'key', false);
      expect(div.outerHTML).to.eql('<div></div>');
    });
  });

  describe('applyStyles', () => {
    it('will call through styles()', () => {
      expect(applyStyles({ foo: 'bar' })).to.eql('foo: bar');
    });
  });

  describe('applyClasses', () => {
    it('will call through classes()', () => {
      expect(applyClasses(['foo'])).to.eql('foo');
    });
  });

  describe('applyAnimations', () => {
    it('will call nextProps() through hooks', async () => {
      applyAnimations(['test'], 'myHook', div);
      expect(typeof div.myHook).to.eql('function');

      td.replace(div.classList, 'add', td.func('addClass'));
      td.replace(div.classList, 'remove', td.func('removeClass'));

      setTimeout(() => div.dispatchEvent(new Event('animationend')), 10);

      await tick(() => div.myHook());

      expect(td.explain(div.classList.add).callCount).to.eql(1);
      expect(td.explain(div.classList.remove).callCount).to.eql(1);
    });
  });
});
