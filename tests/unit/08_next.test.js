import { test } from '@japa/runner';

import {
  render, mount, patch,
} from '../../src/index.js';

import {
  trim, plain, format,
} from '../../src/lib/util.js';

import doc from './fixtures/env.js';

let div;
let old;
function setup(t) {
  t.each.setup(doc.enable);
  t.each.teardown(doc.disable);

  t.each.setup(() => {
    div = document.createElement('div');
    old = undefined;
  });
}

test.group('DOM checks', t => {
  setup(t);

  test('should handle doctype as expected', ({ expect }) => {
    const doctype = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN"
"http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">`;

    if (document.open) {
      const newHTML = document.open('text/html', 'replace');

      newHTML.write(doctype);
      newHTML.close();

      // this is weird but OK!
      expect(newHTML.documentElement.outerHTML).toEqual(!process.env.JS_DOM
        ? `<html><head></head><body>${doctype.replace('\n', ' ')}</body></html>`
        : '<html><head></head><body></body></html>');
    } else {
      const root = document.createElement('root');

      root.innerHTML = doctype;

      expect(root.innerHTML).toEqual(doctype.replace('\n', ' '));
    }
  });

  // why these drivers are not working?
  test('should setup .href from some tags', ({ expect }) => {
    const a = render(['a', { href: 'https://soypache.co?q=42' }, 'Link']);

    if (process.env.HAPPY_DOM) {
      expect(a.getAttribute('href')).toEqual('https://soypache.co?q=42');
      expect(a.href).toBeUndefined();
      expect(a.search).toBeUndefined();
    } else {
      expect(a.href).toEqual('https://soypache.co/?q=42');
      expect(a.search).toEqual('?q=42');
      expect(a.protocol).toEqual('https:');
      expect(a.host).toEqual('soypache.co');
    }

    if (!(process.env.JS_DOM || process.env.HAPPY_DOM)) {
      document.location = 'http://website.com/a/b/c';
    } else {
      Object.defineProperty(window, 'location', {
        value: new URL('http://website.com/a/b/c'),
        writable: true,
      });
    }

    const b = render(['a', { href: '../foo' }, 'Link']);

    b.hash = 'osom';
    b.search = '?ok=42';

    if (process.env.HAPPY_DOM) {
      expect(b.getAttribute('href')).toEqual('../foo');
      expect(b.href).toBeUndefined();
      expect(b.search).toEqual('?ok=42');
    } else {
      // c'mon jsdom you still can!
      expect(b.href).toEqual(process.env.JS_DOM ? '../foo' : 'http://website.com/a/foo?ok=42#osom');
    }
  });

  test('should preserve html-entitites from attrs', ({ expect }) => {
    const span = render(['span', { title: 'foo&bar' }, 'OSOM']);

    expect(span.outerHTML).toEqual('<span title="foo&amp;bar">OSOM</span>');

    const p = document.createElement('p');
    p.innerHTML = '<a href="https://boxfactura.com?source=somedom&amp;t=🦄">OSOM</a>';

    expect(p.outerHTML).toEqual((process.env.JS_DOM || process.env.HAPPY_DOM)
      ? '<p><a href="https://boxfactura.com?source=somedom&amp;t=🦄">OSOM</a></p>'
      : '<p><a href="https://boxfactura.com?source=somedom&amp;t=&#x1F984;">OSOM</a></p>');
  });
});

test.group('quick check', t => {
  setup(t);

  test('flatten vnodes', async ({ expect }) => {
    const target = render(['div', null]);
    const a = [[['this ', ['b', null, 'is']], ' ', 'a '], ['test ', ['only!']]];
    const b = [['b', null, 'this ', 'is'], [[[' a '], 'test'], [[[' only!']]]]];

    mount(target, a);
    expect(target.outerHTML).toEqual('<div>this <b>is</b> a test only!</div>');
    expect(plain(target)).toEqual(['this ', '<b>is</b>', ' ', 'a ', 'test ', 'only!']);

    await patch(target, a, b);
    expect(plain(target)).toEqual(['<b>this is</b>', ' a ', 'test', ' only!']);
  });

  test('invoke factories', ({ expect }) => {
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

    expect(format(document.body.outerHTML)).toEqual(trim(`
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

  test('reconcilliate children', async ({ expect }) => {
    mount(div, old = ['a']);

    await patch(div, old, old = [1, 2, 3, 4]);
    expect(plain(div.childNodes)).toEqual(['1', '2', '3', '4']);

    await patch(div, old, old = [['x', null, ['y']]]);
    expect(plain(div.childNodes)).toEqual([['y']]);
  });

  test('reconcilliate fragments', async ({ expect }) => {
    function Test(_, children) {
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
    expect(plain(div)).toEqual(['<x>A</x>', '<y>B</y>', '<z>C</z>', '<z>c</z>', '<a>D</a>']);

    await patch(div, old, old = [
      ['y', null, ['F']],
      '?',
      [Test, null, [
        ['x', null, ['E']],
        ['x', null, ['e']],
      ]],
    ]);
    expect(plain(div)).toEqual(['<y>F</y>', '?', '<x>E</x>', '<x>e</x>']);

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
    expect(plain(div)).toEqual(['<y>O</y>', '<y>P</y>', '<x>Q</x>', '<z>R</z>']);
  });
});

test.group('fragments check', t => {
  setup(t);

  t.each.setup(() => {
    div = document.createElement('div');
  });

  test('should return an array of nodes', ({ expect }) => {
    div = mount(document.createElement('div'), [
      ['span', null, ['foo']],
      ['span', null, ['bar']],
    ]);

    expect(plain(div)).toEqual(['<span>foo</span>', '<span>bar</span>']);
    expect(div.outerHTML).toEqual('<div><span>foo</span><span>bar</span></div>');
  });

  test('should render children indistinctly', ({ expect }) => {
    expect(render(['p', null, 'hola', 'mundo']).outerHTML).toEqual('<p>holamundo</p>');
    expect(render(['p', null, 'hola', 'mundo']).childNodes.length).toEqual(2);

    expect(render(['p', null, ['hola', 'mundo']]).outerHTML).toEqual('<p>holamundo</p>');
    expect(render(['p', null, ['hola', 'mundo']]).childNodes.length).toEqual(2);

    expect(render(['p', null, [['hola', 'mundo']]]).outerHTML).toEqual('<p>holamundo</p>');
    expect(render(['p', null, [['hola', 'mundo']]]).childNodes.length).toEqual(2);
  });

  test('should render fragments from factories', ({ expect }) => {
    const value = 42;
    const children = [function Random() {
      return ['OK: ', -1];
    }, null];

    expect(mount(document.createElement('div'), [
      ['p', null, [
        ['span', null, ['value: ', value]],
      ]],
      children,
    ]).outerHTML).toEqual('<div><p><span>value: 42</span></p>OK: -1</div>');
  });
});

test.group('fragments patching', t => {
  setup(t);

  let el;
  let tmp;

  test('should update single nodes', async ({ expect }) => {
    el = div;
    tmp = ['div', null];
    await patch(el, tmp, tmp = ['div', null, ['c']]);
    expect(plain(el)).toEqual(['c']);
  });

  test('should append missing nodes', async ({ expect }) => {
    await patch(el, tmp, tmp = ['div', null, ['c', 'd']]);
    expect(plain(el)).toEqual(['c', 'd']);
  });

  test('should unmount deleted nodes', async ({ expect }) => {
    await patch(el, tmp, tmp = ['div', null, ['x']]);
    expect(plain(el)).toEqual(['x']);
  });

  test('should replace changed nodes', async ({ expect }) => {
    el = await patch(el, tmp, tmp = ['a', null, ['x']]);
    expect(plain(el)).toEqual(['x']);
    expect(el.outerHTML).toEqual('<a>x</a>');
  });

  test('should patch through childNodes', async ({ expect }) => {
    await patch(el, tmp, tmp = ['a', 'b', 'c']);
    expect(plain(el)).toEqual(['a', 'b', 'c']);

    await patch(el, tmp, tmp = [['foo', null, ['bar']]]);
    expect(plain(el)).toEqual(['<foo>bar</foo>']);
    expect(el.outerHTML).toEqual('<a><foo>bar</foo></a>');
  });

  test('should patch over mounted fragments', async ({ expect }) => {
    await patch(el, tmp, tmp = [['a', 'b', 'c'], ['d', 'e']]);
    expect(plain(el)).toEqual(['a', 'b', 'c', 'd', 'e']);

    await patch(el, tmp, tmp = [['foo'], ['bar']]);
    expect(plain(el)).toEqual(['foo', 'bar']);

    await patch(el, tmp, tmp = ['baz']);
    expect(plain(el)).toEqual(['baz']);

    el = await patch(el, tmp, tmp = ['baz', null, ['buzz']]);
    expect(plain(el)).toEqual(['buzz']);
    expect(el.outerHTML).toEqual('<baz>buzz</baz>');
  });
});
