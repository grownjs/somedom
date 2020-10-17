/* eslint-disable no-unused-expressions */

import td from 'testdouble';
import { expect } from 'chai';

import {
  h, pre, bind, mount, patch, render, listeners, attributes,
} from '../../src';

import { tick, trim, format } from '../../src/lib/util';
import { bindHelpers as $ } from '../../src/ssr';
import doc from './fixtures/document';

/* global beforeEach, afterEach, describe, it */

describe('somedom', () => {
  let tag;

  beforeEach(doc.enable);
  afterEach(doc.disable);

  describe('h', () => {
    it('should return whatever you pass to', () => {
      expect(h()).to.eql([undefined, undefined, [undefined]]);
      expect(h(1, null, 2)).to.eql([1, undefined, [2]]);
      expect(h(1, {}, 2)).to.eql([1, {}, [2]]);
      expect(h(1, 2, 3, 4, 5)).to.eql([1, undefined, [2, 3, 4, 5]]);
    });
  });

  describe('pre', () => {
    it('should debug and render given vnodes', () => {
      const sample = format('<div><span foo="bar" baz="baz">TEXT</span></div>');

      expect(pre(['div', [
        ['span', { foo: 'bar', baz: true }, ['TEXT']],
      ]]).outerHTML).to.eql(`<pre class="highlight">${sample}</pre>`);
    });
  });

  describe('bind', () => {
    let test1;
    let test2;

    beforeEach(() => {
      tag = td.func('tag');
      test1 = td.func('fn1');
      test2 = td.func('fn2');
    });

    it('should call tag function if arity is <= 2', () => {
      const cb = bind(tag, test1, test2);

      expect(cb(1, 2)).to.be.undefined;

      expect(td.explain(tag).callCount).to.eql(1);
      expect(td.explain(test1).callCount).to.eql(0);
      expect(td.explain(test2).callCount).to.eql(0);
    });

    it('should apply given [...callbacks] if arity >= 3', () => {
      const cb = bind(tag, test1, test2);

      expect(cb(1, 2, 3)).to.be.undefined;

      expect(td.explain(tag).callCount).to.eql(0);
      expect(td.explain(test1).callCount).to.eql(1);
      expect(td.explain(test2).callCount).to.eql(1);
    });

    it('should allow to wrap thunks through view() and tag()', () => {
      const $$ = bind(render);

      const Tag = $$.tag((props, children) => ['em', props, ['OSOM.', children]]);
      const View = $$.view((props, children) => [Tag, props, children]);

      mount([View, { style: 'color:red' }, ['SO?']]);

      expect(document.body.innerHTML).to.eql(trim(`
        <em style="color:red">OSOM.SO?</em>
      `));
    });

    it('should normalize all given arguments on given view calls', () => {
      const View = bind(render)
        .view((props, children) => ['a', props, children]);

      expect(new View().target.outerHTML).to.eql('<a></a>');
      expect(new View(42).target.outerHTML).to.eql('<a>42</a>');
      expect(new View({ x: 'y' }).target.outerHTML).to.eql('<a x="y"></a>');
      expect(new View({ x: 'y' }, [-1]).target.outerHTML).to.eql('<a x="y">-1</a>');
    });
  });

  describe('hooks', () => {
    it('should expose curried functions', () => {
      expect(typeof listeners()).to.eql('function');
      expect(typeof attributes()).to.eql('function');
    });
  });

  describe('patch', () => {
    it('will sync event-handlers properly', async () => {
      tag = bind(render, listeners());

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
        return [[['ul', data.map(x => ['li', { onclick: () => rm(x.id) }, x.value])]]];
      }

      let vnode = view();
      const node = tag(vnode);

      for (let i = 0; i < 2; i += 1) {
        $(node).withText(`Item ${i + 1}`).dispatch('click');
        patch(node, vnode, vnode = view(), null, tag, null);
      }

      await tick();

      expect(format(node.outerHTML)).to.eql(trim(`
        <ul>
          <li>Item 3</li>
          <li>Item 4</li>
          <li>Item 5</li>
        </ul>
      `));
    });
  });
});
