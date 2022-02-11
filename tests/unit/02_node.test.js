/* eslint-disable no-unused-expressions */

import td from 'testdouble';
import { expect } from 'chai';

import {
  createElement, mountElement, destroyElement, updateElement,
} from '../../src/lib/node';

import { trim, format } from '../../src/lib/util';
import Fragment from '../../src/lib/fragment';
import doc from '../../src/ssr/jsdom';

/* global beforeEach, afterEach, describe, it */

describe('node', () => {
  beforeEach(doc.enable);
  afterEach(doc.disable);

  describe('DocumentFragment', () => {
    it('should return fragments before mount', () => {
      const tmp = createElement([['foo', null, ['b', null, ['bar']]]]);

      expect(tmp.childNodes[0].tagName).to.eql('FOO');
      expect(tmp.childNodes[0].childNodes[0].tagName).to.eql('B');
      expect(tmp.childNodes[0].childNodes[0].childNodes[0].nodeValue).to.eql('bar');
    });

    it('should flatten arrays as fragments', () => {
      const tree = createElement([
        ['span', null, ['foo']],
        ['span', null, ['bar']],
      ]);

      const div = document.createElement('div');

      tree.mount(div);
      expect(div.outerHTML).to.eql('<div><span>foo</span><span>bar</span></div>');
      expect([].slice.call(div.childNodes).some(x => x instanceof Fragment)).to.be.false;
    });

    it('should invoke factories from fragments', () => {
      const value = 42;
      const children = [function Random() {
        return ['OK: ', -1];
      }];

      expect(createElement([
        ['p', null, [
          ['span', null, ['value: ', value]],
        ]],
        children,
      ]).outerHTML).to.eql('<p><span>value: 42</span></p>OK: -1');
    });

    it('should render children indistinctly', () => {
      expect(createElement(['p', null, 'hola', 'mundo']).outerHTML).to.eql('<p>holamundo</p>');
      expect(createElement(['p', null, 'hola', 'mundo']).childNodes.length).to.eql(2);

      expect(createElement(['p', null, ['hola', 'mundo']]).outerHTML).to.eql('<p>holamundo</p>');
      expect(createElement(['p', null, ['hola', 'mundo']]).childNodes.length).to.eql(2);

      expect(createElement(['p', null, [['hola', 'mundo']]]).outerHTML).to.eql('<p>holamundo</p>');
      expect(createElement(['p', null, [['hola', 'mundo']]]).childNodes.length).to.eql(2);
    });

    describe('updateElement', () => {
      let div;
      let x;
      let y;

      const factory = (...children) => ({
        vnode: [
          ['span', null, ['OK']],
          ...children,
        ],
        result: `<div><span>OK</span>${children.reduce((memo, it) => memo.concat(it), []).join('')}</div>`,
      });

      beforeEach(() => {
        div = document.createElement('div');
      });

      it('should skip anchors while patching fragments', async () => {
        x = factory('just: ', 'x');
        y = factory('just: ', 'y');

        const el = mountElement(div, x.vnode);
        expect(div.outerHTML).to.eql(x.result);
        expect(div.childNodes.length).to.eql(3);
        expect(x.result).to.contains(el.outerHTML);

        await updateElement(div, x.vnode, y.vnode);
        expect(div.childNodes.length).to.eql(3);
        expect(div.outerHTML).to.eql(y.result);
      });

      it('should skip anchors while patching fragments (mixed)', async () => {
        x = factory('just: ', 'x');
        y = factory(['just: ', 'y']);

        mountElement(div, x.vnode);
        expect(div.outerHTML).to.eql(x.result);

        div = await updateElement(div, x.vnode, y.vnode);
        expect(div.outerHTML).to.eql(y.result);
      });

      it('should skip anchors while patching fragments (nested)', async () => {
        x = factory(['just: ', 'x']);
        y = factory(['just: ', 'y']);

        mountElement(div, x.vnode);
        expect(div.outerHTML).to.eql(x.result);

        await updateElement(div, x.vnode, y.vnode);
        expect(div.outerHTML).to.eql(y.result);
      });

      it('should flatten all nested Fragments into a single one', async () => {
        const vdom = value => [
          ['small', null, ['TEXT']],
          ['\n', '\n\n\n  PATH=/:id/edit\n  ', ['\n  ', value, ':\n'], '\n\n'],
          ['\n', '\n\n\n'],
        ];

        const a = vdom('BEFORE');
        const b = vdom('AFTER');

        div = document.body;
        mountElement(div, a);
        expect(div.childNodes.length).to.eql(9);

        await updateElement(div, a, b);
        expect(div.childNodes.length).to.eql(9);
      });

      it('should trigger onupdate/update methods on fragments', async () => {
        const callback = td.func('update');

        let calls = 0;
        let ref;
        function Test(props, children) {
          const old = ref && ref.root;
          ref = createElement(children);
          ref.parentNode = old;
          ref.onupdate = callback;
          ref.update = callback;
          calls += 1;
          return ref;
        }

        let old;
        mountElement(document.body, old = [
          ['div', null, [
            [Test, { foo: 'bar' }, ['baz']],
          ]],
        ]);

        expect(document.body.innerHTML).to.eql('<div>baz</div>');
        expect(td.explain(callback).callCount).to.eql(0);
        expect(calls).to.eql(1);
        expect(ref.length).to.eql(1);

        await updateElement(document.body, old, old = [
          ['div', null, [
            [Test, { baz: 'buzz' }, ['bazzinga']],
          ]],
        ]);

        expect(calls).to.eql(2);
        expect(td.explain(callback).callCount).to.eql(2);
        expect(document.body.innerHTML).to.eql('<div>bazzinga</div>');

        ref = await updateElement(ref, [[Test, { baz: 'buzz' }, ['bazzinga']]], [[Test, { key: 'x' }, ['yz']]]);
        expect(calls).to.eql(3);
        expect(ref.outerHTML).to.eql('yz');
        expect(document.body.innerHTML).to.eql('<div>yz</div>');

        expect(td.explain(callback).callCount).to.eql(4);
      });
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

    it('should remove all Fragment childNodes', async () => {
      const vdom = createElement([[['OSOM'], ['SO']]]);
      const remove = td.func('-OSOM');
      const remove2 = td.func('-SO');

      vdom.mount(document.createElement('div'));

      td.replace(vdom.children[0], 'remove', remove);
      td.replace(vdom.children[1], 'remove', remove2);

      await vdom.remove();

      expect(td.explain(remove).callCount).to.eql(1);
      expect(td.explain(remove2).callCount).to.eql(1);
    });
  });

  describe('createElement', () => {
    it('should fail on invalid input', () => {
      expect(createElement).to.throw(/Invalid vnode, given 'undefined'/);
    });

    it('should return scalar values as text', () => {
      expect(createElement('Just text').nodeValue).to.eql('Just text');
    });

    it('should handle regular html-elements', () => {
      expect(createElement(['span', null]).tagName).to.eql('SPAN');
    });

    it('should handle svg-elements too', () => {
      expect(createElement(['svg', null]).namespaceURI).to.contains('svg');
    });

    it('should call factories recursively', () => {
      let count = null;

      function Tag(props, children) {
        if (count === null) {
          count = props.count;
          return [Tag, props, children];
        }

        if (count > 3) {
          return ['stop', props, children];
        }

        count += 1;

        return [Tag, { ...props, count }, children];
      }

      const target = createElement([Tag, { count: 0 }, 42]);

      expect(target.outerHTML).to.eql('<stop count="4">42</stop>');
    });

    it('should wrap trees as DocumentFragment nodes', () => {
      const tree = [[[[['p', null, [[[[['i', null]]]]]]]]]];
      const node = createElement(tree);
      node.mount(document.createElement('div'));

      expect(node.parentNode).not.to.be.undefined;
      expect(node.childNodes.length).to.eql(0);
      expect(node.outerHTML).to.eql('<p><i></i></p>');
      expect(node.children[0].tagName).to.eql('P');
      expect(node.children[0].childNodes.length).to.eql(1);
      expect(node.children[0].childNodes[0].nodeType).to.eql(1);
      expect(node.children[0].childNodes[0].tagName).to.eql('I');
      expect(node.children[0].childNodes[0].childNodes.length).to.eql(0);
    });

    it('should pass created element to given callback', () => {
      const spy = td.func('callback');

      createElement(['span', null], null, spy);
      expect(td.explain(spy).callCount).to.eql(1);
    });

    it('should handle functions as elements', () => {
      const attrs = {};
      const nodes = [];

      const Spy = td.func('Component');

      td.when(Spy(attrs, nodes)).thenReturn(['div', null]);

      expect(createElement([Spy, attrs, nodes]).tagName).to.eql('DIV');
    });

    it('should pass given attributes to assignProps()', () => {
      const foo = createElement(['code', { foo: 'bar' }]).attributes.foo;

      expect(foo.nodeValue || foo).to.eql('bar');
    });

    it('should invoke returned functions from hooks', () => {
      const fn = td.func('hook');

      td.when(fn())
        .thenReturn(['div', null]);

      td.when(fn(td.matchers.isA(Object), 'span', null, []))
        .thenReturn(fn);

      const node = createElement(['span', null], null, fn);

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

      createElement(['x', null], null, () => div);

      expect(td.explain(div.oncreate).callCount).to.eql(1);
      expect(td.explain(div.enter).callCount).to.eql(1);

      await div.remove();

      expect(td.explain(div.ondestroy).callCount).to.eql(1);
      expect(td.explain(div.teardown).callCount).to.eql(1);
      expect(td.explain(div.exit).callCount).to.eql(1);
    });

    it('should append non-empty values only', () => {
      expect(createElement(['div', null, [null, false, 0]]).outerHTML).to.eql('<div>false0</div>');
    });

    it('should transform selectors recursively', () => {
      const x = createElement(['a.foo', null, ['b.bar', null, ['c.baz', null]]]).outerHTML;

      expect(x).to.eql('<a class="foo"><b class="bar"><c class="baz"></c></b></a>');
    });
  });

  describe('mountElement', () => {
    const h = createElement;

    function ok(target) {
      expect(target.childNodes.length).to.eql(1);
      expect(target.childNodes[0].tagName).to.eql('SPAN');
    }

    it('returns something even if nothing is given', () => {
      expect(mountElement().outerHTML).to.eql('<body></body>');
    });

    it('should help to mount given vnodes', () => {
      const div = document.createElement('div');

      mountElement(div, ['span', null], h);
      ok(div);
    });

    it('should mount given html-elements', () => {
      const div = document.createElement('div');
      const span = document.createElement('span');

      mountElement(div, span);
      ok(div);
    });

    it('should use document.body if target is not given', () => {
      mountElement(['span', null], h);
      ok(document.body);
    });

    it('should fallback to view if arity is 1', () => {
      mountElement(['span', null]);
      ok(document.body);
    });

    it('should call querySelector() if target is an string', () => {
      td.replace(document, 'querySelector');
      td.when(document.querySelector('body'))
        .thenReturn(document.body);

      mountElement('body', ['span', null]);
      ok(document.body);

      td.reset();
    });

    it('should create markup from scalar values', () => {
      mountElement(null, 42);
      expect(document.body.innerHTML).to.eql('42');
    });

    it('should create fragments from arrays', () => {
      mountElement(null, [42, ['i', null, [-1]]]);
      expect(document.body.innerHTML).to.eql('42<i>-1</i>');
    });

    it('should mount fragments recursively', () => {
      const div = document.createElement('div');

      mountElement(div, [
        'Some text ',
        ['strong', null, ['before HTML']],
        ': ',
        [
          'because',
          ' ',
          ['em', null, ['it is']],
          [' ', [['strong', null, ['possible!']]]],
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

    it('can reconcilliate childNodes', async () => {
      div = await updateElement(div, ['div', null], ['b', null, 'OK!']);
      expect(body.innerHTML).to.eql('<b>OK!</b>');

      div = await updateElement(div, ['b', null, 'OK!'], [['b', null, 'NOT']]);
      expect(body.innerHTML).to.eql('<b>NOT</b>');
    });

    it('can reconcilliate root nodes', async () => {
      expect([div.tagName, body.tagName]).to.eql(['DIV', 'BODY']);
      div = await updateElement(div, ['div', null], ['b', null, 'OK']);
      expect(body.innerHTML).to.eql('<b>OK</b>');
      expect(div.outerHTML).to.eql('<b>OK</b>');

      expect([div.tagName, body.tagName]).to.eql(['B', 'BODY']);
      div = await updateElement(div, ['b', null, 'OK'], [['b', null, 'KO']]);
      expect(body.innerHTML).to.eql('<b>KO</b>');
      expect(div.outerHTML).to.eql('<b>KO</b>');

      expect([div.tagName, body.tagName]).to.eql(['B', 'BODY']);
      div = await updateElement(div, [['b', null, 'KO']], [[['c', null, 'OSOM']]]);
      expect(body.innerHTML).to.eql('<b><c>OSOM</c></b>');
      expect(div.outerHTML).to.eql('<b><c>OSOM</c></b>');

      expect([div.tagName, body.tagName]).to.eql(['B', 'BODY']);
      div = await updateElement(div, [[['c', null, 'OSOM']]], 'bar');
      expect(body.innerHTML).to.eql('<b>bar</b>');
      expect(div.outerHTML).to.eql('<b>bar</b>');
    });

    it('can reconcilliate text nodes', async () => {
      div = await updateElement(div, ['div', null], [['foo bar']]);
      expect(body.innerHTML).to.eql('foo bar');

      div = await updateElement(div, [['foo bar']], [['some text', [[['b', null, 'OK']]]]]);
      expect(div.innerHTML).to.eql('some text<b>OK</b>');

      div = await updateElement(div, [['some text', ['b', null, 'OK']]], ['foo ', 'barX']);
      expect(div.innerHTML).to.eql('foo barX');

      div = await updateElement(div, ['foo ', 'barX'], ['a ', 'OK']);
      expect(div.innerHTML).to.eql('a OK');

      div = await updateElement(div, ['a ', 'OK'], ['a', null, 'OK']);
      expect(div.innerHTML).to.eql('OK');
    });

    it('can reconcilliate between both text/nodes', async () => {
      div = await updateElement(div, 'OLD', [['b', null, 'NEW']]);
      expect(body.innerHTML).to.eql('<div><b>NEW</b></div>');

      div = await updateElement(div, [['a', null]], 'FIXME');
      expect(body.innerHTML).to.eql('<div>FIXME</div>');
    });

    it('can update nodes if they are the same', async () => {
      div = await updateElement(div, ['div', null, ['a', null]], ['div', null, 'NEW']);
      expect(div.outerHTML).to.eql('<div>NEW</div>');
    });

    it('can replace nodes if they are different', async () => {
      await updateElement(div, ['div', null], ['b', null, 'NEW']);
      expect(body.outerHTML).to.eql('<body><b>NEW</b></body>');
    });

    it('can patch node attributes', async () => {
      await updateElement(a, ['a', null], ['a', { href: '#' }]);
      expect(a.outerHTML).to.eql('<a href="#"></a>');
    });

    it('can update scalar values', async () => {
      await updateElement(div, ['div', null, 1], ['div', null, 0]);
      expect(body.innerHTML).to.eql('<div>0</div>');
    });

    it('will invoke hooks on update', async () => {
      a.onupdate = td.func('onupdate');
      a.update = td.func('update');

      await updateElement(a, ['a', null], ['a', { href: '#' }]);

      expect(td.explain(a.onupdate).callCount).to.eql(1);
      expect(td.explain(a.update).callCount).to.eql(1);
    });

    it('can append childNodes', async () => {
      await updateElement(a, ['a', null], ['a', null, [[[['c', null, 'd']]]]]);
      expect(div.innerHTML).to.eql('<a><c>d</c></a>');
    });

    it('can remove childNodes', async () => {
      a.appendChild(createElement(['b', null]));

      await updateElement(a, [[[['b', null]]]], []);

      expect(div.outerHTML).to.eql('<div><a></a></div>');
    });

    it('can update TextNodes', async () => {
      a.appendChild(document.createTextNode('old'));

      a = await updateElement(a, ['old'], ['new']);
      expect(div.outerHTML).to.eql('<div><a>new</a></div>');

      a = await updateElement(a, ['new'], ['osom']);
      expect(div.outerHTML).to.eql('<div><a>osom</a></div>');
    });

    it('will iterate recursively', async () => {
      a.appendChild(createElement(['b', null]));
      await updateElement(a, ['a', null, [['b', null]]], ['a', null, [[[[['b', null]]]]]]);
      expect(a.outerHTML).to.eql('<a><b></b></a>');
    });

    it('will append given children', async () => {
      a = await updateElement(a, ['a', null], ['a', null, [['b', null]]]);
      expect(a.outerHTML).to.eql('<a><b></b></a>');

      a = await updateElement(a, ['a', null, [['b', null]]], ['a', null, [[['i', null], [[[['i', null]]]], [[[[['i', null]]]]]]]]);
      expect(a.outerHTML).to.eql('<a><i></i><i></i><i></i></a>');
    });

    it('patch over function values', async () => {
      const Em = Array.prototype.concat.bind(['em', null]);

      function Del(props, children) {
        return ['del', null, [[Em, props, children]]];
      }

      const $old = [[[Del, null, 'OK']]];
      const $new = [[[[[Del, null, [[['OSOM!']]]]]]]];

      createElement($old).mount(a);
      a = await updateElement(a, $old, $new);

      expect(a.innerHTML).to.eql('<del><em>OSOM!</em></del>');
      expect(div.innerHTML).to.eql('<a><del><em>OSOM!</em></del></a>');
      expect(body.innerHTML).to.eql('<div><a><del><em>OSOM!</em></del></a></div>');
    });
  });
});
