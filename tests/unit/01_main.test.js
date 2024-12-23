import * as td from 'testdouble';
import { test } from '@japa/runner';

import {
  h, pre, bind, mount, patch, render, listeners, attributes,
} from '../../src/index.js';

import { tick, trim, format } from '../../src/lib/util.js';
import { bindHelpers as $ } from '../../src/ssr/index.js';
import { encodeText } from '../../src/ssr/doc.js';

import Fragment from '../../src/lib/fragment.js';
import doc from './fixtures/env.js';

test.group('h', () => {
  test('should return well formed vnodes', ({ expect }) => {
    expect(h()).toEqual(['div', null, []]);
    expect(h('grab')).toEqual(['grab', null, []]);
    expect(h('grab', 'a')).toEqual(['grab', null, ['a']]);
    expect(h('grab', 'a', 'beer')).toEqual(['grab', null, ['a', 'beer']]);
    expect(h('grab', 'a', null, 'beer')).toEqual(['grab', null, ['a', 'beer']]);
    expect(h('grab', h('a', 'beer'))).toEqual(['grab', null, ['a', null, ['beer']]]);
    expect(h('grab', [h('a', 'beer')])).toEqual(['grab', null, [['a', null, ['beer']]]]);
    expect(h('grab', [h('a', ['beer', 'with', 'friends'])])).toEqual(['grab', null, [['a', null, ['beer', 'with', 'friends']]]]);
  });
});

test.group('pre', t => {
  t.each.teardown(doc.disable);
  t.each.setup(doc.enable);

  test('should debug and render given vnodes', ({ expect }) => {
    const sample = encodeText(format('<div><span foo="bar" baz="baz">TEXT</span></div>'), { quotes: false });

    expect(pre(['div', null,
      ['span', { foo: 'bar', baz: true }, 'TEXT'],
    ]).outerHTML).toEqual(`<pre class="highlight">${sample}</pre>`);
  });
});

test.group('hooks', () => {
  test('should expose curried functions', ({ expect }) => {
    expect(typeof listeners()).toEqual('function');
    expect(typeof attributes()).toEqual('function');
  });
});

test.group('bind', t => {
  let tag;
  let test1;
  let test2;

  t.each.setup(() => {
    tag = td.func('tag');
    test1 = td.func('fn1');
    test2 = td.func('fn2');
  });

  test('should call tag function if arity is <= 2', ({ expect }) => {
    const cb = bind(tag, test1, test2);

    expect(cb(1, 2)).toBeUndefined();

    expect(td.explain(tag).callCount).toEqual(1);
    expect(td.explain(test1).callCount).toEqual(0);
    expect(td.explain(test2).callCount).toEqual(0);
  });

  test('should apply given [...callbacks] if arity >= 3', ({ expect }) => {
    const cb = bind(tag, test1, test2);

    expect(cb(1, 2, 3)).toBeUndefined();

    expect(td.explain(tag).callCount).toEqual(0);
    expect(td.explain(test1).callCount).toEqual(1);
    expect(td.explain(test2).callCount).toEqual(1);
  });
});

test.group('patch', t => {
  let prop = 'outerHTML';
  let node;
  let tag;

  async function setup(expect, useFragment) {
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
      const partial = ['ul', null, data.map(x => ['li', { onclick: () => rm(x.id) }, x.value])];

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

    expect(format(node[prop])).toEqual(trim(`
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

    expect(td.explain(rm).callCount).toEqual(2);

    expect(format(node[prop])).toEqual(trim(`
      <ul>
        <li>Item 3</li>
        <li>Item 4</li>
        <li>Item 5</li>
      </ul>
    `));
  }

  t.each.teardown(doc.disable);
  t.each.setup(doc.enable);

  test('will sync event-handlers properly', async ({ expect }) => {
    await setup(expect);
  });

  test('will sync event-handlers properly (fragments)', async ({ expect }) => {
    await setup(expect, true);
  });

  test('should allow to register and render from custom tag extensions', async ({ expect }) => {
    const $$ = bind(render, [{
      test(props, children) {
        return ['a', props, children];
      },
    }]);

    expect($$(['test', null, [1]]).outerHTML).toEqual('<a>1</a>');
    expect($$(['x', null, [['test', null, 2]]]).outerHTML).toEqual('<x><a>2</a></x>');
    expect($$(['div', null, [() => ['test', null, [3]]]]).outerHTML).toEqual('<div><a>3</a></div>');

    const div = document.createElement('div');

    mount(div, [['test', null, [1]]], null, $$);
    expect(div.outerHTML).toEqual('<div><a>1</a></div>');

    await patch(div, [['test', null, [1]]], [['test', null, [2]]], null, $$);
    expect(div.outerHTML).toEqual('<div><a>2</a></div>');
  });

  test('should append and remove childNodes as needed', async ({ expect }) => {
    mount(document.body, ['\n']);

    const c = ['\n'];
    const d = ['\n', ['p', { class: 'ok' }, ['OSOM']], '\n'];

    await patch(document.body, c, d);
    expect(document.body.outerHTML).toEqual('<body>\n<p class="ok">OSOM</p>\n</body>');
    while (document.body.firstChild) document.body.removeChild(document.body.firstChild);

    mount(document.body, d);
    await patch(document.body, d, c);
    expect(document.body.outerHTML).toEqual('<body>\n</body>');
  });

  test('should patch childNodes from fragments', async ({ expect }) => {
    const $$ = bind(render, [{
      fragment(_, children) {
        return Fragment.from($$, children);
      },
    }]);

    const prev = [
      '\n',
      ['nav', null, [
        ['ul', null, [
          ['li', null, ['Home']],
          ['fragment', { key: 'user-menu' }, [
            '\n',
            ['li', null, ['Profile']],
            '\n',
          ]],
        ]],
      ]],
      ['fragment', { key: 'flash-info' }, ['\n']],
      ['main', null, ['MARKUP']],
    ];

    mount(document.body, prev, null, $$);
    expect(document.body.outerHTML).toEqual(`<body>
<nav><ul><li>Home</li>
<li>Profile</li>
</ul></nav>
<main>MARKUP</main></body>`);

    const next = [
      '\n',
      ['nav', null, [
        ['ul', null, [
          ['li', null, ['Home']],
          ['fragment', { key: 'user-menu' }, ['\n']],
        ]],
      ]],
      ['fragment', { key: 'flash-info' }, [['p', null, 'Done.'], '\n']],
      ['main', null, ['FORM']],
    ];

    await patch(document.body, prev, next, null, $$);

    expect(document.body.outerHTML).toEqual(`<body>
<nav><ul><li>Home</li>
</ul></nav><p>Done.</p>
<main>FORM</main></body>`);
  });
});
