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
    expect(h()).toEqual(['div', {}, []]);
    expect(h('grab')).toEqual(['grab', {}, []]);
    expect(h('grab', 'a')).toEqual(['grab', {}, ['a']]);
    expect(h('grab', 'a', 'beer')).toEqual(['grab', {}, ['a', 'beer']]);
    expect(h('grab', h('a', 'beer'))).toEqual(['grab', {}, ['a', {}, ['beer']]]);
    expect(h('grab', [h('a', 'beer')])).toEqual(['grab', {}, [['a', {}, ['beer']]]]);
    expect(h('grab', [h('a', ['beer', 'with', 'friends'])])).toEqual(['grab', {}, [['a', {}, ['beer', 'with', 'friends']]]]);
  });
});

test.group('pre', t => {
  t.each.teardown(doc.disable);
  t.each.setup(doc.enable);

  test('should debug and render given vnodes', ({ expect }) => {
    let sample = format('<div><span foo="bar" baz="baz">TEXT</span></div>');

    // why no escape this happy-dom?
    if (!process.env.HAPPY_DOM) {
      sample = encodeText(sample, { quotes: false });
    }

    expect(pre(['div', {},
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
      const partial = ['ul', {}, data.map(x => ['li', { onclick: () => rm(x.id) }, x.value])];

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

    expect($$(['test', {}, [1]]).outerHTML).toEqual('<a>1</a>');
    expect($$(['x', {}, [['test', {}, 2]]]).outerHTML).toEqual('<x><a>2</a></x>');
    expect($$(['div', {}, [() => ['test', {}, [3]]]]).outerHTML).toEqual('<div><a>3</a></div>');

    const div = document.createElement('div');

    mount(div, [['test', {}, [1]]], null, $$);
    expect(div.outerHTML).toEqual('<div><a>1</a></div>');

    await patch(div, [['test', {}, [1]]], [['test', {}, [2]]], null, $$);
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
      ['nav', {}, [
        ['ul', {}, [
          ['li', {}, ['Home']],
          ['fragment', { key: 'user-menu' }, [
            '\n',
            ['li', {}, ['Profile']],
            '\n',
          ]],
        ]],
      ]],
      ['fragment', { key: 'flash-info' }, ['\n']],
      ['main', {}, ['MARKUP']],
    ];

    mount(document.body, prev, null, $$);
    expect(document.body.outerHTML).toEqual(`<body>
<nav><ul><li>Home</li>
<li>Profile</li>
</ul></nav>
<main>MARKUP</main></body>`);

    const next = [
      '\n',
      ['nav', {}, [
        ['ul', {}, [
          ['li', {}, ['Home']],
          ['fragment', { key: 'user-menu' }, ['\n']],
        ]],
      ]],
      ['fragment', { key: 'flash-info' }, [['p', {}, 'Done.'], '\n']],
      ['main', {}, ['FORM']],
    ];

    await patch(document.body, prev, next, null, $$);

    expect(document.body.outerHTML).toEqual(`<body>
<nav><ul><li>Home</li>
</ul></nav><p>Done.</p>
<main>FORM</main></body>`);
  });
});
