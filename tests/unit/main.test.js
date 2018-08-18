/* eslint-disable no-unused-expressions */

import td from 'testdouble';
import { expect } from 'chai';

import {
  h, pre, bind, listeners, attributes,
} from '../../src';

import { format } from '../../src/lib/util';
import doc from './fixtures/document';

/* global beforeEach, afterEach, describe, it */

describe('somedom', () => {
  describe('h', () => {
    it('should fallback to valid defaults', () => {
      expect(h()).to.eql(['div', undefined, []]);
    });

    it('should return whatever you pass to', () => {
      expect(h(1, 2, 3, 4, 5)).to.eql([1, 2, [3, 4, 5]]);
    });
  });

  describe('pre', () => {
    beforeEach(doc.enable);
    afterEach(doc.disable);

    it('should debug and render given vnodes', () => {
      const sample = format('<div><span foo="bar" baz="baz">TEXT</span></div>');

      expect(pre(['div', [
        ['span', { foo: 'bar', baz: true }, ['TEXT']],
      ]]).outerHTML).to.eql(`<pre class="highlight">${sample}</pre>`);
    });
  });

  describe('bind', () => {
    let tag;
    let test1;
    let test2;

    beforeEach(() => {
      tag = td.func('tag');
      test1 = td.func('fn1');
      test2 = td.func('fn2');
    });

    it('should call tag function if arity is <= 2', () => {
      const render = bind(tag, test1, test2);

      expect(render(1, 2)).to.be.undefined;

      expect(td.explain(tag).callCount).to.eql(1);
      expect(td.explain(test1).callCount).to.eql(0);
      expect(td.explain(test2).callCount).to.eql(0);
    });

    it('should apply given [...callbacks] if arity >= 3', () => {
      const render = bind(tag, test1, test2);

      expect(render(1, 2, 3)).to.be.undefined;

      expect(td.explain(tag).callCount).to.eql(0);
      expect(td.explain(test1).callCount).to.eql(1);
      expect(td.explain(test2).callCount).to.eql(1);
    });
  });

  describe('hooks', () => {
    it('should expose curried functions', () => {
      expect(typeof listeners()).to.eql('function');
      expect(typeof attributes()).to.eql('function');
    });
  });
});
