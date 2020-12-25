/* eslint-disable no-unused-expressions */

import td from 'testdouble';
import { expect } from 'chai';

import { view } from '../../src';
import { trim } from '../../src/lib/util';

import {
  useWindow,
  renderToString,
  bindHelpers as $,
} from '../../src/ssr';

import doc from './fixtures/document';

/* global beforeEach, afterEach, describe, it */

function main() {
  const $actions = {
    down: value => state => ({
      count: state.count - value,
    }),
    up: value => state => ({
      count: state.count + value,
    }),
  };

  const $state = {
    count: 0,
  };

  const $view = (state, actions) => ['div', [
    ['h1', [state.count]],
    ['button',
      { onclick: () => actions.down(1) }, '-'],
    ['button',
      { onclick: () => actions.up(1) }, '+'],
    ['button',
      { onclick: () => actions.unmount() }, 'Remove me'],
  ]];

  return view($view, $state, $actions);
}

function getMock(value) {
  return trim(`
    <div>
      <h1>${value}</h1>
      <button>-</button>
      <button>+</button>
      <button>Remove me</button>
    </div>
  `);
}

describe('SSR', () => {
  beforeEach(doc.enable);
  afterEach(doc.disable);

  describe('useWindow', () => {
    it('should attach document and window globally', () => {
      doc.disable();
      expect(() => document).to.throw(/document is not defined/);

      useWindow(() => {
        expect(() => document).not.to.throw();
      });

      expect(() => document).to.throw(/document is not defined/);
    });
  });

  describe('bindHelpers', () => {
    it('should help to locate nodes in the DOM', () => {
      const div = document.createElement('div');
      const span = document.createElement('span');

      div.appendChild(span);
      span.appendChild(document.createTextNode('OSOM'));

      document.body.appendChild(div);

      expect($(document.body).withText(/OSOM/)).to.eql(span);
    });
  });

  describe('renderToString', () => {
    it('can render static vnodes as markup', async () => {
      const vnode = ['h1', null, 'It works!'];
      const dom = renderToString(vnode);

      const html = await dom();

      expect(html).to.eql('<h1>It works!</h1>');
    });

    it('can render dynamic views as markup', async () => {
      const nth = Math.round(Math.random() * 10) + 1;
      const app = renderToString(main());

      doc.enable();
      await app.up(nth);

      const html = await app();

      expect(html).to.eql(getMock(nth));
    });
  });

  describe('document', () => {
    it('does not support querySelector', () => {
      expect(document.querySelector()).to.be.undefined;
    });

    it('works fine with classList', () => {
      const div = document.createElement('div');

      div.classList.add('foo', 'bar');
      div.classList.remove('foo');
      div.classList.toggle('baz');
      div.classList.replace('baz', 'buzz');
      div.classList.toggle('test');
      div.classList.toggle('test');
      div.classList.toggle('test', true);
      div.classList.toggle('test', false);

      expect(div.classList.item(-1)).to.be.null;
      expect(div.classList.item(0)).to.eql('bar');
      expect(div.classList.item(1)).to.eql('buzz');
      expect(div.classList.contains('foo')).to.be.false;
      expect(div.classList.contains('bar')).to.be.true;
      expect(div.classList.contains('baz')).to.be.false;
      expect(div.classList.contains('buzz')).to.be.true;

      expect(div.outerHTML).to.eql('<div class="bar buzz"></div>');
    });

    it('should handle self-closing tags', () => {
      expect(document.createElement('img').outerHTML).to.eql('<img/>');
    });

    it('should handle event-listeners too', () => {
      const a = document.createElement('a');
      const fn = td.func('callback');

      a.addEventListener('test', fn);
      a.removeEventListener('undef');

      a.dispatchEvent({ type: 'test' });
      a.dispatchEvent({ type: 'undef' });

      expect(td.explain(fn).callCount).to.eql(1);

      a.removeEventListener('test', fn);

      expect(a.eventListeners).to.eql({ test: [] });
    });
  });
});
