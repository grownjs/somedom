/* eslint-disable no-unused-expressions */

import td from 'testdouble';
import { expect } from 'chai';

import {
  createElement, mountElement, destroyElement, updateElement, createView,
} from '../../src/lib/node';

import doc from './fixtures/document';

/* global beforeEach, afterEach, describe, it */

describe('node', () => {
  beforeEach(doc.enable);
  afterEach(doc.disable);

  describe('destroyElement', () => {
    let parent;
    let div;

    beforeEach(() => {
      parent = document.createElement('root');
      div = document.createElement('div');

      div.remove = td.func('remove');
      parent.appendChild(div);
    });

    it('should invoke node.remove() method from given node', async () => {
      await destroyElement(div);
      expect(td.explain(div.remove).callCount).to.eql(1);
    });

    it('should skip removal if wait() does not resolve', async () => {
      await destroyElement(div, () => null);
      expect(td.explain(div.remove).callCount).to.eql(0);
    });
  });

  describe('createElement', () => {
    it('should fail on invalid input', () => {
      expect(createElement).to.throw(/Empty or invalid node/);
    });

    it('should return scalar values as text', () => {
      expect(createElement('Just text').nodeValue).to.eql('Just text');
    });

    it('should handle regular html-elements', () => {
      expect(createElement(['span']).tagName).to.eql('SPAN');
    });

    it('should handle svg-elements too', () => {
      expect(createElement(['svg']).isSvg).to.be.true;
    });

    it('should handle children as 2nd argument', () => {
      expect(createElement(['span', [1, 'foo']]).childNodes.map(x => x.nodeValue)).to.eql([1, 'foo']);
      expect(createElement(['span', 'TEXT']).childNodes.map(x => x.nodeValue)).to.eql(['TEXT']);
      expect(createElement(['span', 12.3]).childNodes.map(x => x.nodeValue)).to.eql([12.3]);
      expect(createElement(['span', false]).childNodes).to.eql([]);
    });

    it('should pass created element to given callback', () => {
      const spy = td.func('callback');

      createElement(['span'], null, spy);
      expect(td.explain(spy).callCount).to.eql(1);
    });

    it('should handle functions as elements', () => {
      const div = document.createElement('div');
      const attrs = {};
      const nodes = [];

      const Spy = td.func('Component');

      td.when(Spy(attrs, nodes)).thenReturn(div);
      td.when(Spy(null, ['TEXT'])).thenReturn('TEXT');

      expect(createElement([Spy, attrs, nodes])).to.eql(div);
      expect(createElement([Spy, null, ['TEXT']]).nodeValue).to.eql('TEXT');
    });

    it('should pass given attributes to assignProps()', () => {
      expect(createElement(['code', { foo: 'bar' }]).attributes).to.eql({ foo: 'bar' });
    });

    it('should append given nodes as childNodes', () => {
      const node = createElement(['ul', [
        ['li', 1],
        ['li', 2],
      ]]);

      expect([node.tagName, node.childNodes.map(x => [x.tagName, x.childNodes.map(y => y.nodeValue)])]).to.eql([
        'UL', [
          ['LI', [1]],
          ['LI', [2]],
        ],
      ]);
    });

    it('should invoke returned functions from hooks', () => {
      const fn = td.func('hook');

      td.when(fn())
        .thenReturn(['div']);

      td.when(fn(td.matchers.isA(Object), 'span', {}, []))
        .thenReturn(fn);

      const node = createElement(['span'], null, fn);

      expect(td.explain(fn).callCount).to.eql(3);
      expect(node.outerHTML).to.eql('<div></div>');
    });

    it('should invoke events/hooks', async () => {
      const div = document.createElement('div');

      div.oncreate = td.func('oncreate');
      div.ondestroy = td.func('ondestroy');
      div.teardown = td.func('teardown');
      div.enter = td.func('enter');
      div.exit = td.func('exit');

      createElement(['x'], null, () => div);

      expect(td.explain(div.oncreate).callCount).to.eql(1);
      expect(td.explain(div.enter).callCount).to.eql(1);

      await div.remove();

      expect(td.explain(div.ondestroy).callCount).to.eql(1);
      expect(td.explain(div.teardown).callCount).to.eql(1);
      expect(td.explain(div.exit).callCount).to.eql(1);
    });

    it('should append non-empty values only', () => {
      expect(createElement(['div', [null, false, 0]]).outerHTML).to.eql('<div>0</div>');
    });
  });

  describe('mountElement', () => {
    const h = createElement;

    function ok(target) {
      expect(target.childNodes.length).to.eql(1);
      expect(target.childNodes[0].tagName).to.eql('SPAN');
    }

    it('should help to mount given vnodes', () => {
      const div = document.createElement('div');

      mountElement(div, ['span'], h);
      ok(div);
    });

    it('should mount given html-elements', () => {
      const div = document.createElement('div');
      const span = document.createElement('span');

      mountElement(div, span);
      ok(div);
    });

    it('should use document.body if target is not given', () => {
      mountElement(['span'], h);
      ok(document.body);
    });

    it('should fallback to view if arity is 1', () => {
      mountElement(['span']);
      ok(document.body);
    });

    it('should call querySelector() if target is an string', () => {
      td.replace(document, 'querySelector');
      td.when(document.querySelector('body'))
        .thenReturn(document.body);

      mountElement('body', ['span']);
      ok(document.body);

      td.reset();
    });
  });

  describe('updateElement', () => {
    let div;
    let a;

    beforeEach(() => {
      div = document.createElement('div');
      a = document.createElement('a');

      div.appendChild(a);

      expect(a.outerHTML).to.eql('<a></a>');
    });

    it('can patch node attributes', () => {
      updateElement(a, ['a'], ['a', { href: '#' }], null, undefined, null);
      expect(a.outerHTML).to.eql('<a href="#"></a>');
    });

    it('will invoke hooks on update', async () => {
      a.onupdate = td.func('onupdate');
      a.update = td.func('update');

      await updateElement(a, ['a'], ['a', { href: '#' }], null, undefined, null);

      expect(td.explain(a.onupdate).callCount).to.eql(1);
      expect(td.explain(a.update).callCount).to.eql(1);
    });

    it('can replace childNodes', async () => {
      await updateElement(div, ['a'], ['b']);
      expect(div.outerHTML).to.eql('<div><b></b></div>');
    });

    it('can append childNodes', async () => {
      await updateElement(a, ['a'], ['a', [['c', 'd']]], null, undefined, null);
      expect(div.outerHTML).to.eql('<div><a><c>d</c></a></div>');
    });

    it('can remove childNodes', async () => {
      a.appendChild(createElement(['b']));

      updateElement(a, ['a', [['b']]], ['a'], null, undefined, null);

      await new Promise(resolve => setTimeout(resolve));

      expect(div.outerHTML).to.eql('<div><a></a></div>');
    });

    it('can update TextNodes', async () => {
      a.appendChild(document.createTextNode());
      await updateElement(a, ['a', 'old'], ['a', 'old'], null, undefined, null);
      await updateElement(a, ['a', 'old'], ['a', 'new'], null, undefined, null);
      expect(div.outerHTML).to.eql('<div><a>new</a></div>');
    });

    it('will iterate recursively', () => {
      a.appendChild(createElement(['b']));
      updateElement(a, ['a', [['b']]], ['a', [['b']]], null, undefined, null);
      expect(a.outerHTML).to.eql('<a><b></b></a>');
    });
  });

  describe('createView', () => {
    let tag;
    let data;
    let actions;

    beforeEach(() => {
      tag = td.func('render');
      data = { foo: 'BAR' };
      actions = { setFoo: value => () => ({ foo: value }) };

      td.when(tag(td.matchers.isA(Object), td.matchers.isA(Object)))
        .thenReturn(['a']);
    });

    it('can be removed form the DOM calling unmount()', async () => {
      const app = createView(tag, data, actions);
      const $ = app();

      await $.unmount();

      expect(document.body.innerHTML).to.eql('');
    });

    it('will render state-driven components', () => {
      const app = createView(tag, data, actions);
      const $ = app();

      expect($.target.outerHTML).to.eql('<a></a>');
    });

    it('should re-render on state changes', async () => {
      const app = createView(({ foo }) => ['a', foo], data, actions);
      const $ = app();

      expect($.target.outerHTML).to.eql('<a>BAR</a>');

      await $.setFoo('OK');

      expect($.target.outerHTML).to.eql('<a>OK</a>');
    });
  });
});
