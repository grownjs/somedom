/* eslint-disable no-unused-expressions */

import td from 'testdouble';
import { expect } from 'chai';

import {
  h, pre, bind, patch, render, listeners, attributes,
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
      const $ = bind(tag, test1, test2);

      expect($(1, 2)).to.be.undefined;

      expect(td.explain(tag).callCount).to.eql(1);
      expect(td.explain(test1).callCount).to.eql(0);
      expect(td.explain(test2).callCount).to.eql(0);
    });

    it('should apply given [...callbacks] if arity >= 3', () => {
      const $ = bind(tag, test1, test2);

      expect($(1, 2, 3)).to.be.undefined;

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

  describe('patch', () => {
    beforeEach(doc.enable);
    afterEach(doc.disable);

    it('will sync event-handlers properly', async () => {
      const $ = bind(render, listeners());
      const rm = td.func('removeItem');

      let data = [
        { id: 1, value: 'Item 1' },
        { id: 2, value: 'Item 2' },
        { id: 3, value: 'Item 3' },
        { id: 4, value: 'Item 4' },
        { id: 5, value: 'Item 5' },
      ];

      function filter(nth) {
        data = data.filter(x => x.id !== nth);
      }

      data.map(x => td.when(rm(x.id)).thenDo(() => filter(x.id)));

      function view() {
        return ['ul', data.map(x => ['li', { onclick: () => rm(x.id) }, x.value])];
      }

      let vnode = view();
      const node = $(vnode);

      for (let i = 0; i < 2; i += 1) {
        node.withText(`Item ${i + 1}`)[0].dispatchEvent({ type: 'click' });
        patch(node, vnode, vnode = view(), null, $, null);
      }

      await new Promise(ok => setTimeout(ok, 100));

      expect(format(node.outerHTML)).to.eql(format(`<ul>
        <li>Item 3</li>
        <li>Item 4</li>
        <li>Item 5</li>
      </ul>`));
    });
  });
});
