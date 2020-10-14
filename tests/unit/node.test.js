/* eslint-disable no-unused-expressions */

import td from 'testdouble';
import { expect } from 'chai';

import {
  createElement, mountElement, destroyElement, updateElement,
} from '../../src/lib/node';

import { tick, trim, format } from '../../src/lib/util';

import doc from './fixtures/document';

/* global beforeEach, afterEach, describe, it */

beforeEach(doc.enable);
afterEach(doc.disable);

describe('node', () => {
  describe('DocumentFragment', () => {
    it('should flatten arrays as fragments', () => {
      const tree = createElement([
        ['span', 'foo'],
        ['span', 'bar'],
      ]);

      const div = document.createElement('div');
      div.appendChild(tree);

      expect(div.outerHTML).to.eql('<div><span>foo</span><span>bar</span></div>');
    });
  });

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
      expect(createElement).to.throw(/Invalid vnode/);
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
      expect(createElement(['span', [1, 'foo']]).childNodes.map(x => x.nodeValue)).to.eql(['1', 'foo']);
      expect(createElement(['span', 'TEXT']).childNodes.map(x => x.nodeValue)).to.eql(['TEXT']);
      expect(createElement(['span', 12.3]).childNodes.map(x => x.nodeValue)).to.eql(['12.3']);
      expect(createElement(['span', false]).childNodes).to.eql([]);
    });

    it('should wrap trees as DocumentFragment nodes', () => {
      const tree = [[[[['p', [[[[['i']]]]]]]]]];
      const node = createElement(tree);

      let depth = 0;
      let obj = node;

      while (obj && obj.childNodes) {
        depth += 1;
        obj = obj.childNodes[0];
      }

      expect(depth).to.eql(3);
      expect(node.outerHTML).to.eql('<p><i></i></p>');
    });

    it('should pass created element to given callback', () => {
      const spy = td.func('callback');

      createElement(['span'], null, spy);
      expect(td.explain(spy).callCount).to.eql(1);
    });

    it('should handle functions as elements', () => {
      const attrs = {};
      const nodes = [];

      const Spy = td.func('Component');

      td.when(Spy(attrs, nodes)).thenReturn(['div']);

      expect(createElement([Spy, attrs, nodes]).tagName).to.eql('DIV');
    });

    it('should pass given attributes to assignProps()', () => {
      expect(createElement(['code', { foo: 'bar' }]).attributes).to.eql({ foo: 'bar' });
    });

    it('should append given nodes as childNodes', () => {
      const node = createElement(['ul', [
        ['li', '1'],
        ['li', '2'],
      ]]);

      expect([node.tagName, node.childNodes.map(x => [x.tagName, x.childNodes.map(y => y.nodeValue)])]).to.eql([
        'UL', [
          ['LI', ['1']],
          ['LI', ['2']],
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

    it('can mount fragments recursively', () => {
      const div = document.createElement('div');

      mountElement(div, [
        'Some text ',
        ['strong', 'before HTML'],
        ': ',
        [
          'because',
          ' ',
          ['em', 'it is'],
          [' ', [['strong', 'possible!']]],
        ],
      ]);

      expect(format(div.outerHTML)).to.eql(trim(`
        <div>Some text <strong>before HTML</strong>: because <em>it is</em> <strong>possible!</strong>
        </div>
      `));
    });
  });

  describe('updateElement', () => {
    let body;
    let div;
    let a;

    beforeEach(() => {
      body = document.createElement('body');
      div = document.createElement('div');
      a = document.createElement('a');

      body.appendChild(div);
      div.appendChild(a);

      expect(a.outerHTML).to.eql('<a></a>');
    });

    it('can reconcilliate child nodes', () => {
      updateElement(div, [['a']], ['b', 'OK!']);
      expect(div.innerHTML).to.eql('<b>OK!</b>');

      updateElement(div, [[['b', 'OK']]], [['b', 'NOT']]);
      expect(div.innerHTML).to.eql('<b>NOT</b>');
    });

    it('can reconcilliate root nodes', () => {
      updateElement(div, ['a'], ['b', 'OK']);
      expect(body.innerHTML).to.eql('<b>OK</b>');

      updateElement(div, ['a'], [['b', 'OK']]);
      expect(body.innerHTML).to.eql('<b>OK</b>');

      updateElement(div, [['a']], [[[['b', 'OK']]]]);
      expect(body.innerHTML).to.eql('<b>OK</b>');

      updateElement(div, 'foo', 'bar');
      expect(body.innerHTML).to.eql('bar');
    });

    it('can reconcilliate text nodes', () => {
      updateElement(div, ['div'], [['foo bar']]);
      expect(body.innerHTML).to.eql('<div>foo bar</div>');

      updateElement(div, [[[['b', 'OK']]]], [['some text', [[['b', 'OK']]]]]);
      expect(body.innerHTML).to.eql('<div>some text<b>OK</b></div>');

      updateElement(div, [['some text', ['b', 'OK']]], ['foo ', 'barX']);
      expect(body.innerHTML).to.eql('<div>foo barX</div>');

      updateElement(div, ['foo ', 'barX'], ['a ', 'OK']);
      expect(body.innerHTML).to.eql('<div>a OK</div>');

      updateElement(div, ['a', 'OK'], ['a', 'OK']);
      expect(body.innerHTML).to.eql('<a>OK</a>');
    });

    it('can reconcilliate between both text/nodes', () => {
      updateElement(div, 'OLD', ['b', 'NEW']);
      expect(body.outerHTML).to.eql('<body><b>NEW</b></body>');

      updateElement(div, ['a'], 'FIXME');
      expect(body.outerHTML).to.eql('<body>FIXME</body>');
    });

    it('can update nodes if they are the same', () => {
      updateElement(div, ['div'], ['div', 'NEW']);
      expect(body.outerHTML).to.eql('<body><div>NEW</div></body>');
    });

    it('can replace nodes if they are different', () => {
      updateElement(div, ['div'], ['b', 'NEW']);
      expect(body.outerHTML).to.eql('<body><b>NEW</b></body>');
    });

    it('can patch node attributes', () => {
      updateElement(a, ['a'], ['a', { href: '#' }]);
      expect(a.outerHTML).to.eql('<a href="#"></a>');
    });

    it('will invoke hooks on update', () => {
      a.onupdate = td.func('onupdate');
      a.update = td.func('update');

      updateElement(a, ['a'], ['a', { href: '#' }]);

      expect(td.explain(a.onupdate).callCount).to.eql(1);
      expect(td.explain(a.update).callCount).to.eql(1);
    });

    it('can append childNodes', () => {
      updateElement(a, ['a'], ['a', [[[['c', 'd']]]]]);
      expect(div.outerHTML).to.eql('<div><a><c>d</c></a></div>');
    });

    it('can remove childNodes', async () => {
      a.appendChild(createElement(['b']));

      updateElement(a, ['a', [[[['b']]]]], ['a']);
      await tick();

      expect(div.outerHTML).to.eql('<div><a></a></div>');
    });

    it('can update TextNodes', () => {
      a.appendChild(document.createTextNode());
      updateElement(a, ['a', 'old'], ['a', 'old']);
      updateElement(a, ['a', 'old'], ['a', 'new']);
      expect(div.outerHTML).to.eql('<div><a>new</a></div>');
    });

    it('will iterate recursively', () => {
      a.appendChild(createElement(['b']));
      updateElement(a, ['a', [['b']]], ['a', [[[[['b']]]]]]);
      expect(a.outerHTML).to.eql('<a><b></b></a>');
    });

    it('will append given children', () => {
      a.appendChild(createElement(['b']));
      updateElement(a, ['b'], [['i'], [[[['i']]]], [[[[['i']]]]]]);
      expect(a.outerHTML).to.eql('<a><i></i><i></i><i></i></a>');
    });

    it('patch over function values', () => {
      const Em = Array.prototype.concat.bind(['em']);

      function Del(props, children) {
        return ['del', [[Em, props, children]]];
      }

      const $old = [[[Del, 'OK']]];
      const $new = [[[[[Del, [[['OSOM!']]]]]]]];

      a.appendChild(createElement($old));
      updateElement(a, $old, $new);

      expect(a.outerHTML).to.eql('<a><del><em>OSOM!</em></del></a>');
    });
  });
});
