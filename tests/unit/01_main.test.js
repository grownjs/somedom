/* eslint-disable no-unused-expressions */

import * as td from 'testdouble';
import { expect } from 'chai';

import {
  h, pre, bind, mount, patch, render, listeners, attributes,
} from '../../src/index.js';

import { tick, trim, format } from '../../src/lib/util.js';
import { bindHelpers as $ } from '../../src/ssr/index.js';
import { encodeText } from '../../src/ssr/doc.js';

import Fragment from '../../src/lib/fragment.js';
import doc from './fixtures/env.js';

/* global beforeEach, afterEach, describe, it */

describe('somedom', () => {
  let tag;

  beforeEach(doc.enable);
  afterEach(doc.disable);

  describe('h', () => {
    it('should return well formed vnodes', () => {
      expect(h()).to.eql(['div', null, []]);
      expect(h('grab')).to.eql(['grab', null, []]);
      expect(h('grab', 'a')).to.eql(['grab', null, ['a']]);
      expect(h('grab', 'a', 'beer')).to.eql(['grab', null, ['a', 'beer']]);
      expect(h('grab', 'a', null, 'beer')).to.eql(['grab', null, ['a', 'beer']]);
      expect(h('grab', h('a', 'beer'))).to.eql(['grab', null, ['a', null, ['beer']]]);
      expect(h('grab', [h('a', 'beer')])).to.eql(['grab', null, [['a', null, ['beer']]]]);
      expect(h('grab', [h('a', ['beer', 'with', 'friends'])])).to.eql(['grab', null, [['a', null, ['beer', 'with', 'friends']]]]);
    });
  });

  describe('pre', () => {
    it('should debug and render given vnodes', () => {
      let sample = format('<div><span foo="bar" baz="baz">TEXT</span></div>');

      // why no escape this happy-dom?
      if (!process.env.HAPPY_DOM) {
        sample = encodeText(sample, { quotes: false });
      }

      expect(pre(['div', null,
        ['span', ['foo', 'bar', 'baz', true], 'TEXT'],
      ]).outerHTML).to.eql(`<pre class="highlight">${sample}</pre>`);
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

    it('should allow to register and render from custom tag extensions', async () => {
      const $$ = bind(render, [{
        test(props, children) {
          return ['a', props, children];
        },
      }]);

      expect($$(['test', null, [42]]).outerHTML).to.eql('<a>42</a>');
      expect($$(['x', null, [['test', null, 42]]]).outerHTML).to.eql('<x><a>42</a></x>');
      expect($$(['div', null, [() => ['test', null, [42]]]]).outerHTML).to.eql('<div><a>42</a></div>');

      const div = document.createElement('div');

      mount(div, [['test', null, [1]]], null, $$);
      expect(div.outerHTML).to.eql('<div><a>1</a></div>');

      await patch(div, [['test', null, [1]]], [['test', null, [2]]], null, $$);
      expect(div.outerHTML).to.eql('<div><a>2</a></div>');
    });

    it('should append and remove childNodes as needed', async () => {
      mount(document.body, ['\n']);

      const c = ['\n'];
      const d = ['\n', ['p', ['class', 'ok'], ['OSOM']], '\n'];

      await patch(document.body, c, d);
      expect(document.body.outerHTML).to.eql('<body>\n<p class="ok">OSOM</p>\n</body>');
      while (document.body.firstChild) document.body.removeChild(document.body.firstChild);

      mount(document.body, d);
      await patch(document.body, d, c);
      expect(document.body.outerHTML).to.eql('<body>\n</body>');
    });

    it('should patch childNodes from fragments', async () => {
      const $$ = bind(render, [{
        fragment(props, children) {
          return Fragment.from($$, children);
        },
      }]);

      const prev = [
        '\n',
        ['nav', null, [
          ['ul', null, [
            ['li', null, ['Home']],
            ['fragment', ['key', 'user-menu'], [
              '\n',
              ['li', null, ['Profile']],
              '\n',
            ]],
          ]],
        ]],
        ['fragment', ['key', 'flash-info'], ['\n']],
        ['main', null, ['MARKUP']],
      ];

      mount(document.body, prev, null, $$);
      expect(document.body.outerHTML).to.eql(`<body>
<nav><ul><li>Home</li>
<li>Profile</li>
</ul></nav>
<main>MARKUP</main></body>`);

      const next = [
        '\n',
        ['nav', null, [
          ['ul', null, [
            ['li', null, ['Home']],
            ['fragment', ['key', 'user-menu'], ['\n']],
          ]],
        ]],
        ['fragment', ['key', 'flash-info'], [['p', null, 'Done.'], '\n']],
        ['main', null, ['FORM']],
      ];

      await patch(document.body, prev, next, null, $$);

      expect(document.body.outerHTML).to.eql(`<body>
<nav><ul><li>Home</li>
</ul></nav><p>Done.</p>
<main>FORM</main></body>`);
    });
  });

  describe('hooks', () => {
    it('should expose curried functions', () => {
      expect(typeof listeners()).to.eql('function');
      expect(typeof attributes()).to.eql('function');
    });
  });

  describe('patch', () => {
    let prop = 'outerHTML';
    let node;

    async function setup(useFragment) {
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
        const partial = ['ul', null, data.map(x => ['li', ['onclick', () => rm(x.id)], x.value])];

        return useFragment
          ? [partial]
          : partial;
      }

      let vnode = view();

      tag = bind(render, listeners());
      node = tag(vnode);

      if (useFragment) {
        const div = document.createElement('div');

        prop = 'innerHTML';
        node.mount(div);
        node = div;
      }

      expect(format(node[prop])).to.eql(trim(`
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
          <li>Item 3</li>
          <li>Item 4</li>
          <li>Item 5</li>
        </ul>
      `));

      for (let i = 0; i < 2; i += 1) {
        $(node).withText(`Item ${i + 1}`).dispatchEvent(new Event('click'));

        await tick(); // eslint-disable-line
        await patch(node, vnode, vnode = view(), null, tag, null); // eslint-disable-line
      }

      expect(td.explain(rm).callCount).to.eql(2);
    }

    afterEach(() => {
      expect(format(node[prop])).to.eql(trim(`
        <ul>
          <li>Item 3</li>
          <li>Item 4</li>
          <li>Item 5</li>
        </ul>
      `));
    });

    it('will sync event-handlers properly', async () => {
      await setup();
    });

    it('will sync event-handlers properly (fragments)', async () => {
      await setup(true);
    });
  });
});
