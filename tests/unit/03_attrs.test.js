/* eslint-disable no-unused-expressions */

import * as td from 'testdouble';
import { expect } from 'chai';

import {
  assignProps, updateProps,
} from '../../src/lib/attrs.js';

import doc from './fixtures/env.js';

/* global beforeEach, afterEach, describe, it */

describe('attrs', () => {
  beforeEach(doc.enable);
  afterEach(doc.disable);

  let div;
  beforeEach(() => {
    div = document.createElement('div');
  });

  describe('assignProps', () => {
    it('should keep empty attributes', () => {
      assignProps(div, ['foo', '']);
      expect(div.getAttribute('foo')).to.eql('');
    });

    it('should append given attributes', () => {
      assignProps(div, ['foo', 'bar']);
      expect(div.getAttribute('foo')).to.eql('bar');
    });

    it('should skip special attributes, like key', () => {
      assignProps(div, ['key', 'bar']);
      expect(div.getAttribute('key')).to.be.null;
    });

    it('should pass special attributes to given callback', () => {
      const spy = td.func('callback');

      assignProps(div, ['baz', ['buzz']], null, spy);
      expect(td.explain(spy).callCount).to.eql(1);
    });

    it('should handle boolean attributes as expected', () => {
      assignProps(div, ['test', true]);
      expect(div.getAttribute('test')).to.eql('test');
    });

    it('should handle attributes from svg-elements too', () => {
      const svg = document.createElementNS('xmlns', 'svg');

      assignProps(svg, ['xlink:href', 'z'], true);
      expect(svg.getAttribute('href')).to.eql('z');
    });

    it('should remove attributes on falsy values', () => {
      div.setAttribute('foo', 'bar');
      div.setAttribute('hrez', 'baz');

      assignProps(div, [
        'foo', false,
        'xlink:href', null,
        'notFalsy', 0,
        'emptyValue', '',
      ], true);

      expect(div.getAttribute('foo')).to.eql(null);
      expect(div.getAttribute('href')).to.eql(null);
      expect(div.getAttribute('notFalsy')).to.eql('0');
      expect(div.getAttribute('emptyValue')).to.eql('');
    });

    it('should handle the @html prop', () => {
      assignProps(div, ['@html', '<b>OSOM</b>'], true);

      expect(div.outerHTML).to.eql('<div><b>OSOM</b></div>');
    });

    it('should skip :static props', () => {
      assignProps(div, [':disabled', true], true);

      expect(div.outerHTML).to.not.contains(' disabled');
    });

    it('should handle class/style directives', () => {
      assignProps(div, [
        'style:backgroundColor', 'red',
        'style:font-size', '12px',
        'class:enabled', 1,
        'class:disabled', null,
      ]);

      expect(div.outerHTML).to.contains(' class="enabled"');
      expect(div.outerHTML).to.contains(' style="background-color: red; font-size: 12px;"');
    });
  });

  describe('updateProps', () => {
    it('should update changed values only', () => {
      div.setAttribute('a', 'b');
      div.setAttribute('foo', 'bar');
      div.setAttribute('href', 'baz');

      const attrs = Object.keys(div.attributes).reduce((memo, cur) => memo.concat(cur, div.attributes[cur]), []);

      updateProps(div, attrs, ['foo', 'BAR', 'a', 'b']);
      expect(div.getAttribute('foo')).to.eql('BAR');
      expect(div.getAttribute('a')).to.eql('b');
    });

    it('should assign new props', () => {
      updateProps(div, [], ['class', 'red']);
      expect(div.getAttribute('class')).to.eql('red');
    });
  });
});
