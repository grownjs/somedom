/* eslint-disable no-unused-expressions */

import { expect } from 'chai';

import {
  render, mount, patch,
} from '../../src';

import {
  trim, plain, format,
} from '../../src/lib/util';

import * as doc from '../../src/ssr/jsdom';

/* global beforeEach, afterEach, describe, it */

describe('@next', () => {
  beforeEach(doc.enable);
  afterEach(doc.disable);

  let div;
  let old;
  beforeEach(() => {
    div = document.createElement('div');
    old = undefined;
  });

  describe('quick check', () => {
    it('flatten vnodes', async () => {
      const target = render(['div', null]);
      const a = [[['this ', ['b', null, 'is']], ' ', 'a '], ['test ', ['only!']]];
      const b = [['b', null, 'this ', 'is'], [[[' a '], 'test'], [[[' only!']]]]];

      mount(target, a);
      expect(target.outerHTML).to.eql('<div>this <b>is</b> a test only!</div>');
      expect(plain(target)).to.eql(['this ', '<b>is</b>', ' ', 'a ', 'test ', 'only!']);

      await patch(target, a, b);
      expect(plain(target)).to.eql(['<b>this is</b>', ' a ', 'test', ' only!']);
    });

    it('invoke factories', () => {
      function Test(props, children) {
        return ['div', props, children];
      }

      mount(document.body, ['ul', null, [
        ['li', null, 'foo'],
        [['li', null, [
          [Test, null, [
            [Test, null, 'bar'],
          ]],
        ]]],
      ]]);

      expect(format(document.body.outerHTML)).to.eql(trim(`
        <body>
          <ul>
            <li>foo</li>
            <li>
              <div>
                <div>bar</div>
              </div>
            </li>
          </ul>
        </body>
      `));
    });

    it('reconcilliate children', async () => {
      mount(div, old = ['a']);

      await patch(div, old, old = [1, 2, 3, 4]);
      expect(plain(div.childNodes)).to.eql(['1', '2', '3', '4']);

      await patch(div, old, old = [['x', null, ['y']]]);
      expect(plain(div.childNodes)).to.eql([['y']]);
    });

    it('reconcilliate fragments', async () => {
      function Test(props, children) {
        return render(children);
      }

      mount(div, old = [
        ['x', null, ['A']],
        [Test, null, [
          ['y', null, ['B']],
        ]],
        [Test, null, [
          ['z', null, ['C']],
          ['z', null, ['c']],
        ]],
        ['a', null, ['D']],
      ]);
      expect(plain(div)).to.eql(['<x>A</x>', '', '<y>B</y>', '', '', '<z>C</z>', '<z>c</z>', '', '<a>D</a>']);

      await patch(div, old, old = [
        ['y', null, ['F']],
        '?',
        [Test, null, [
          ['x', null, ['E']],
          ['x', null, ['e']],
        ]],
      ]);
      expect(plain(div)).to.eql(['<y>F</y>', '?', '', '<x>E</x>', '<x>e</x>', '']);

      await patch(div, old, old = [
        ['y', null, ['O']],
        ['y', null, ['P']],
        [Test, null, [
        ]],
        ['x', null, ['Q']],
        [Test, null, [
          ['z', null, ['R']],
        ]],
      ]);
      expect(plain(div)).to.eql(['<y>O</y>', '<y>P</y>', '', '', '<x>Q</x>', '', '<z>R</z>', '']);
    });
  });

  describe('fragments', () => {
    beforeEach(() => {
      div = document.createElement('div');
    });

    it('should return an array of nodes', () => {
      div = mount(document.createElement('div'), [
        ['span', null, ['foo']],
        ['span', null, ['bar']],
      ]);

      expect(plain(div)).to.eql(['<span>foo</span>', '<span>bar</span>']);
      expect(div.outerHTML).to.eql('<div><span>foo</span><span>bar</span></div>');
    });

    it('should render children indistinctly', () => {
      expect(render(['p', null, 'hola', 'mundo']).outerHTML).to.eql('<p>holamundo</p>');
      expect(render(['p', null, 'hola', 'mundo']).childNodes.length).to.eql(2);

      expect(render(['p', null, ['hola', 'mundo']]).outerHTML).to.eql('<p>holamundo</p>');
      expect(render(['p', null, ['hola', 'mundo']]).childNodes.length).to.eql(2);

      expect(render(['p', null, [['hola', 'mundo']]]).outerHTML).to.eql('<p>holamundo</p>');
      expect(render(['p', null, [['hola', 'mundo']]]).childNodes.length).to.eql(2);
    });

    it('should render fragments from factories', () => {
      const value = 42;
      const children = [function Random() {
        return ['OK: ', -1];
      }, null];

      expect(mount(document.createElement('div'), [
        ['p', null, [
          ['span', null, ['value: ', value]],
        ]],
        children,
      ]).outerHTML).to.eql('<div><p><span>value: 42</span></p>OK: -1</div>');
    });

    describe('patching', () => {
      let el;
      let tmp;

      it('should update single nodes', async () => {
        el = div;
        tmp = ['div', null];
        await patch(el, tmp, tmp = ['div', null, ['c']]);
        expect(plain(el)).to.eql(['', 'c', '']);
      });

      it('should append missing nodes', async () => {
        await patch(el, tmp, tmp = ['div', null, ['c', 'd']]);
        expect(plain(el)).to.eql(['', 'c', 'd', '']);
      });

      it('should unmount deleted nodes', async () => {
        await patch(el, tmp, tmp = ['div', null, ['x']]);
        expect(plain(el)).to.eql(['', 'x', '']);
      });

      it('should replace changed nodes', async () => {
        el = await patch(el, tmp, tmp = ['a', null, ['x']]);
        expect(plain(el)).to.eql(['x']);
        expect(el.outerHTML).to.eql('<a>x</a>');
      });

      it('should patch through childNodes', async () => {
        await patch(el, tmp, tmp = ['a', 'b', 'c']);
        expect(plain(el)).to.eql(['a', 'b', 'c']);

        await patch(el, tmp, tmp = [['foo', null, ['bar']]]);
        expect(plain(el)).to.eql(['<foo>bar</foo>']);
        expect(el.outerHTML).to.eql('<a><foo>bar</foo></a>');
      });

      it('should patch over nested fragments', async () => {
        await patch(el, tmp, tmp = [['a', 'b', 'c'], ['d', 'e']]);
        expect(plain(el)).to.eql(['', 'a', 'b', 'c', '', '', 'd', 'e', '']);

        await patch(el, tmp, tmp = [['foo'], ['bar']]);
        expect(plain(el)).to.eql(['', 'foo', '', '', 'bar', '']);

        await patch(el, tmp, tmp = ['baz']);
        expect(plain(el)).to.eql(['baz']);

        el = await patch(el, tmp, tmp = ['baz', null, ['buzz']]);
        expect(plain(el)).to.eql(['buzz']);
        expect(el.outerHTML).to.eql('<baz>buzz</baz>');
      });
    });
  });
});
