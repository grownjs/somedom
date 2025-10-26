import * as td from 'testdouble';
import { test } from '@japa/runner';

import {
  createElement, mountElement, destroyElement, updateElement,
} from '../../src/lib/node.js';

import { trim, format } from '../../src/lib/util.js';
import Fragment from '../../src/lib/fragment.js';
import doc from './fixtures/env.js';

test.group('DocumentFragment', t => {
  t.each.teardown(doc.disable);
  t.each.setup(doc.enable);

  test('should return fragments before mount', ({ expect }) => {
    const tmp = createElement([['foo', {}, ['b', {}, ['bar']]]]);

    expect(tmp.childNodes[0].tagName).toEqual('FOO');
    expect(tmp.childNodes[0].childNodes[0].tagName).toEqual('B');
    expect(tmp.childNodes[0].childNodes[0].childNodes[0].nodeValue).toEqual('bar');
  });

  test('should flatten arrays as fragments', ({ expect }) => {
    const tree = createElement([
      ['span', {}, ['foo']],
      ['span', {}, ['bar']],
    ]);

    const div = document.createElement('div');

    tree.mount(div);
    expect(div.outerHTML).toEqual('<div><span>foo</span><span>bar</span></div>');
    expect([].slice.call(div.childNodes).some(x => Fragment.valid(x))).toBeFalsy();
  });

  test('should invoke factories from fragments', ({ expect }) => {
    const value = 42;
    const children = [function Random() {
      return ['OK: ', -1];
    }];

    createElement([
      ['p', {}, [
        ['span', {}, ['value: ', value]],
      ]],
      children,
    ]).mount(document.body);

    expect(document.body.innerHTML).toEqual('<p><span>value: 42</span></p>OK: -1');
  });

  test('should render children indistinctly', ({ expect }) => {
    expect(createElement(['p', {}, 'hola', 'mundo']).outerHTML).toEqual('<p>holamundo</p>');
    expect(createElement(['p', {}, 'hola', 'mundo']).childNodes.length).toEqual(2);

    expect(createElement(['p', {}, ['hola', 'mundo']]).outerHTML).toEqual('<p>holamundo</p>');
    expect(createElement(['p', {}, ['hola', 'mundo']]).childNodes.length).toEqual(2);

    expect(createElement(['p', {}, [['hola', 'mundo']]]).outerHTML).toEqual('<p>holamundo</p>');
    expect(createElement(['p', {}, [['hola', 'mundo']]]).childNodes.length).toEqual(2);
  });
});

test.group('updateElement', t => {
  t.each.teardown(doc.disable);
  t.each.setup(doc.enable);

  let div;
  let x;
  let y;

  const factory = (...children) => ({
    vnode: [
      ['span', {}, ['OK']],
      ...children,
    ],
    result: `<div><span>OK</span>${children.reduce((memo, it) => memo.concat(it), []).join('')}</div>`,
  });

  t.each.setup(() => {
    div = document.createElement('div');
  });

  test('should remove blank nodes prior patching', async ({ expect }) => {
    div.innerHTML = '\n <b>OK</b>';
    await updateElement(div, [], [42]);
    expect(div.outerHTML).toEqual('<div>42</div>');
  });

  test('should skip anchors while patching fragments', async ({ expect }) => {
    x = factory('just: ', 'x');
    y = factory('just: ', 'y');

    const el = mountElement(div, x.vnode);
    expect(div.outerHTML).toEqual(x.result);
    expect(div.childNodes.length).toEqual(3);
    expect(x.result).toContain(el.outerHTML);

    await updateElement(div, x.vnode, y.vnode);
    expect(div.childNodes.length).toEqual(3);
    expect(div.outerHTML).toEqual(y.result);
  });

  test('should skip anchors while patching fragments (mixed)', async ({ expect }) => {
    x = factory('just: ', 'x');
    y = factory(['just: ', 'y']);

    mountElement(div, x.vnode);
    expect(div.outerHTML).toEqual(x.result);

    div = await updateElement(div, x.vnode, y.vnode);
    expect(div.outerHTML).toEqual(y.result);
  });

  test('should skip anchors while patching fragments (nested)', async ({ expect }) => {
    x = factory(['just: ', 'x']);
    y = factory(['just: ', 'y']);

    mountElement(div, x.vnode);
    expect(div.outerHTML).toEqual(x.result);

    await updateElement(div, x.vnode, y.vnode);
    expect(div.outerHTML).toEqual(y.result);
  });

  test('should flatten all nested Fragments into a single one', async ({ expect }) => {
    const vdom = value => [
      ['small', {}, ['TEXT']],
      ['\n', '\n\n\n  PATH=/:id/edit\n  ', ['\n  ', value, ':\n'], '\n\n'],
      ['\n', '\n\n\n'],
    ];

    const a = vdom('BEFORE');
    const b = vdom('AFTER');

    div = document.body;
    mountElement(div, a);
    expect(div.childNodes.length).toEqual(9);

    await updateElement(div, a, b);
    expect(div.childNodes.length).toEqual(9);
  });

  test('should handle updates with @html attributes', async ({ expect }) => {
    mountElement(document.body, [
      ['div', { '@html': '<b>OSOM</b>' }],
    ]);

    expect(document.body.innerHTML).toEqual('<div><b>OSOM</b></div>');

    const old = [['div', { class: 'x' }, ['b', {}, 'OSOM']]];
    const next = [['div', { class: 'y', '@html': '<em>OK</em>' }]];

    await updateElement(document.body, old, next);

    expect(document.body.innerHTML).toEqual('<div class="y"><em>OK</em></div>');
  });

  test('should expand @ into data- attributes', async ({ expect }) => {
    mountElement(document.body, [
      ['b', { '@foo': 'bar' }, 'OK'],
    ]);

    expect(document.body.innerHTML).toEqual('<b data-foo="bar">OK</b>');
  });
});

test.group('destroyElement', t => {
  t.each.teardown(doc.disable);
  t.each.setup(doc.enable);

  let parent;
  let div;

  t.each.setup(() => {
    parent = document.createElement('root');
    div = document.createElement('div');

    div.remove = td.func('remove');
    parent.appendChild(div);
  });

  test('should invoke node.remove() method from given node', async ({ expect }) => {
    await destroyElement(div);
    expect(td.explain(div.remove).callCount).toEqual(1);
  });

  test('should skip removal if wait() does not resolve', async ({ expect }) => {
    await destroyElement(div, () => null);
    expect(td.explain(div.remove).callCount).toEqual(0);
  });
});

test.group('createElement', t => {
  t.each.teardown(doc.disable);
  t.each.setup(doc.enable);

  test('should fail on invalid input', ({ expect }) => {
    expect(createElement).toThrow(/Invalid vnode, given 'undefined'/);
  });

  test('should return scalar values as text', ({ expect }) => {
    expect(createElement('Just text').nodeValue).toEqual('Just text');
  });

  test('should handle regular html-elements', ({ expect }) => {
    expect(createElement(['span', {}]).tagName).toEqual('SPAN');
  });

  test('should handle svg-elements too', ({ expect }) => {
    expect(createElement(['svg', {}]).namespaceURI).toContain('svg');
  });

  test('should call factories recursively', ({ expect }) => {
    let count = null;
    function Tag(props, children) {
      if (count === null) {
        count = props.count;
        return [Tag, props, children];
      }

      if (count > 3) {
        return ['b', props, children];
      }

      count += 1;
      props.count = count;

      return [Tag, props, children];
    }

    const target = createElement([Tag, { count: 0 }, 42]);

    expect(target.outerHTML).toEqual('<b count="4">42</b>');
  });

  test('should wrap trees as DocumentFragment nodes', ({ expect }) => {
    const tree = [[[[['p', {}, [[[[['i', {}]]]]]]]]]];
    const node = createElement(tree);
    const div = document.createElement('div');
    node.mount(div);

    expect(div.innerHTML).toEqual('<p><i></i></p>');
    expect(div.childNodes[0].tagName).toEqual('P');
    expect(div.childNodes[0].childNodes.length).toEqual(1);
    expect(div.childNodes[0].childNodes[0].nodeType).toEqual(1);
    expect(div.childNodes[0].childNodes[0].tagName).toEqual('I');
    expect(div.childNodes[0].childNodes[0].childNodes.length).toEqual(0);
  });

  test('should pass created element to given callback', ({ expect }) => {
    const spy = td.func('callback');

    createElement(['span', {}], null, spy);
    expect(td.explain(spy).callCount).toEqual(1);
  });

  test('should handle functions as elements', ({ expect }) => {
    const attrs = [];
    const nodes = [];

    const Spy = td.func('Component');

    td.when(Spy(attrs, [nodes])).thenReturn(['div', {}]);

    expect(createElement([Spy, attrs, nodes]).tagName).toEqual('DIV');
  });

  test('should pass given attributes to assignProps()', ({ expect }) => {
    const foo = createElement(['code', { foo: 'bar' }]).attributes.foo;

    expect(foo.nodeValue || foo.value || foo).toEqual('bar');
  });

  test('should invoke returned functions from hooks', ({ expect }) => {
    const fn = td.func('hook');

    td.when(fn())
      .thenReturn(['div', {}]);

    td.when(fn(td.matchers.isA(Object), 'span', {}, []))
      .thenReturn(fn);

    const node = createElement(['span', {}], null, fn);

    expect(td.explain(fn).callCount).toEqual(3);
    expect(node.outerHTML).toEqual('<div></div>');
  });

  test('should invoke events/hooks', async ({ expect }) => {
    const div = document.createElement('div');

    div.oncreate = td.func('oncreate');
    div.ondestroy = td.func('ondestroy');
    div.teardown = td.func('teardown');
    div.enter = td.func('enter');
    div.exit = td.func('exit');

    createElement(['x', {}], null, () => div);

    expect(td.explain(div.oncreate).callCount).toEqual(1);
    expect(td.explain(div.enter).callCount).toEqual(1);

    await Promise.resolve(div.remove());

    expect(td.explain(div.ondestroy).callCount).toEqual(1);
    expect(td.explain(div.teardown).callCount).toEqual(1);
    expect(td.explain(div.exit).callCount).toEqual(1);
  });

  test('should append non-empty values only', ({ expect }) => {
    expect(createElement(['div', {}, [null, false, 0]]).outerHTML).toEqual('<div>false0</div>');
  });

  test('should call oncreate through ref props', ({ expect }) => {
    const ref = {};
    const node = createElement(['div', { ref }, 42]);

    expect(ref.current).toEqual(node);
  });
});

test.group('mountElement', t => {
  t.each.teardown(doc.disable);
  t.each.setup(doc.enable);

  const h = createElement;

  function ok(expect, target) {
    expect(target.childNodes.length).toEqual(1);
    expect(target.childNodes[0].tagName).toEqual('SPAN');
  }

  test('returns something even if nothing is given', ({ expect }) => {
    expect(mountElement().outerHTML).toEqual('<body></body>');
  });

  test('should help to mount given vnodes', ({ expect }) => {
    const div = document.createElement('div');

    mountElement(div, ['span', {}], h);
    ok(expect, div);
  });

  test('should mount given html-elements', ({ expect }) => {
    const div = document.createElement('div');
    const span = document.createElement('span');

    mountElement(div, span);
    ok(expect, div);
  });

  test('should use document.body if target is not given', ({ expect }) => {
    mountElement(['span', {}], h);
    ok(expect, document.body);
  });

  test('should fallback to view if arity is 1', ({ expect }) => {
    mountElement(['span', {}]);
    ok(expect, document.body);
  });

  test('should call querySelector() if target is an string', ({ expect }) => {
    td.replace(document, 'querySelector');
    td.when(document.querySelector('body'))
      .thenReturn(document.body);

    mountElement('body', ['span', {}]);
    ok(expect, document.body);

    td.reset();
  });

  test('should create markup from scalar values', ({ expect }) => {
    mountElement(null, 42);
    expect(document.body.innerHTML).toEqual('42');
  });

  test('should create fragments from arrays', ({ expect }) => {
    mountElement(null, [42, ['i', {}, [-1]]]);
    expect(document.body.innerHTML).toEqual('42<i>-1</i>');
  });

  test('should mount fragments recursively', ({ expect }) => {
    const div = document.createElement('div');

    mountElement(div, [
      'Some text ',
      ['strong', {}, ['before HTML']],
      ': ',
      [
        'because',
        ' ',
        ['em', {}, ['it is']],
        [' ', [['strong', {}, ['possible!']]]],
      ],
    ]);

    expect(format(div.outerHTML)).toEqual(trim(`
      <div>Some text <strong>before HTML</strong>: because <em>it is</em> <strong>possible!</strong>
      </div>
    `));
  });
});

test.group('updateElement', t => {
  t.each.teardown(doc.disable);
  t.each.setup(doc.enable);

  let body;
  let div;
  let a;

  t.each.setup(() => {
    body = document.createElement('body');
    div = document.createElement('div');
    a = document.createElement('a');

    body.appendChild(div);
    div.appendChild(a);
  });

  test('verify initial DOM', ({ expect }) => {
    expect(a.outerHTML).toEqual('<a></a>');
  });

  test('can reconcilliate childNodes', async ({ expect }) => {
    div = await updateElement(div, ['div', null], ['b', {}, 'OK!']);
    expect(body.innerHTML).toEqual('<b>OK!</b>');

    div = await updateElement(div, ['b', {}, 'OK!'], [['b', {}, 'NOT']]);
    expect(body.innerHTML).toEqual('<b>NOT</b>');
  });

  test('can reconcilliate root nodes', async ({ expect }) => {
    expect([div.tagName, body.tagName]).toEqual(['DIV', 'BODY']);
    div = await updateElement(div, ['div', null], ['b', {}, 'OK']);
    expect(body.innerHTML).toEqual('<b>OK</b>');
    expect(div.outerHTML).toEqual('<b>OK</b>');

    expect([div.tagName, body.tagName]).toEqual(['B', 'BODY']);
    div = await updateElement(div, ['b', {}, 'OK'], [['b', {}, 'KO']]);
    expect(body.innerHTML).toEqual('<b>KO</b>');
    expect(div.outerHTML).toEqual('<b>KO</b>');

    expect([div.tagName, body.tagName]).toEqual(['B', 'BODY']);
    div = await updateElement(div, [['b', {}, 'KO']], [[['c', {}, 'OSOM']]]);
    expect(body.innerHTML).toEqual('<b><c>OSOM</c></b>');
    expect(div.outerHTML).toEqual('<b><c>OSOM</c></b>');

    expect([div.tagName, body.tagName]).toEqual(['B', 'BODY']);
    div = await updateElement(div, [[['c', {}, 'OSOM']]], 'bar');
    expect(body.innerHTML).toEqual('<b>bar</b>');
    expect(div.outerHTML).toEqual('<b>bar</b>');
  });

  test('can reconcilliate text nodes', async ({ expect }) => {
    div = await updateElement(div, ['div', null], [['foo bar']]);
    expect(body.innerHTML).toEqual('<div>foo bar</div>');

    div = await updateElement(div, [['foo bar']], [['some text', [[['b', {}, 'OK']]]]]);
    expect(div.innerHTML).toEqual('some text<b>OK</b>');

    div = await updateElement(div, [['some text', ['b', {}, 'OK']]], ['foo ', 'barX']);
    expect(div.innerHTML).toEqual('foo barX');

    div = await updateElement(div, ['foo ', 'barX'], ['a ', 'OK']);
    expect(div.innerHTML).toEqual('a OK');

    div = await updateElement(div, ['a ', 'OK'], ['a', {}, 'OK']);
    expect(div.innerHTML).toEqual('OK');
  });

  test('can reconcilliate between both text/nodes', async ({ expect }) => {
    div = await updateElement(div, 'OLD', [['b', {}, 'NEW']]);
    expect(body.innerHTML).toEqual('<div><b>NEW</b></div>');

    div = await updateElement(div, [['a', null]], 'FIXME');
    expect(body.innerHTML).toEqual('<div>FIXME</div>');
  });

  test('can update nodes if they are the same', async ({ expect }) => {
    div = await updateElement(div, ['div', {}, ['a', {}]], ['div', {}, 'NEW']);
    expect(div.outerHTML).toEqual('<div>NEW</div>');
  });

  test('can replace nodes if they are different', async ({ expect }) => {
    await updateElement(div, ['div', {}], ['b', {}, 'NEW']);
    expect(body.outerHTML).toEqual('<body><b>NEW</b></body>');
  });

  test('can patch node attributes', async ({ expect }) => {
    await updateElement(a, ['a', {}], ['a', { href: '#' }]);
    expect(a.outerHTML).toEqual('<a href="#"></a>');
  });

  test('can update scalar values', async ({ expect }) => {
    await updateElement(div, ['div', {}, 1], ['div', {}, 0]);
    expect(body.innerHTML).toEqual('<div>0</div>');
  });

  test('will invoke hooks on update', async ({ expect }) => {
    a.onupdate = td.func('onupdate');
    a.update = td.func('update');

    await updateElement(a, ['a', {}], ['a', { href: '#' }]);

    expect(td.explain(a.onupdate).callCount).toEqual(1);
    expect(td.explain(a.update).callCount).toEqual(1);
  });

  test('can append childNodes', async ({ expect }) => {
    await updateElement(a, ['a', {}], ['a', {}, [[[['c', {}, 'd']]]]]);
    expect(div.innerHTML).toEqual('<a><c>d</c></a>');
  });

  test('can remove childNodes', async ({ expect }) => {
    a.appendChild(createElement(['b', {}]));

    await updateElement(a, [[[['b', {}]]]], []);

    expect(div.outerHTML).toEqual('<div><a></a></div>');
  });

  test('can update TextNodes', async ({ expect }) => {
    a.appendChild(document.createTextNode('old'));

    a = await updateElement(a, ['old'], ['new']);
    expect(div.outerHTML).toEqual('<div><a>new</a></div>');

    a = await updateElement(a, ['new'], ['osom']);
    expect(div.outerHTML).toEqual('<div><a>osom</a></div>');
  });

  test('will iterate recursively', async ({ expect }) => {
    a.appendChild(createElement(['b', {}]));
    await updateElement(a, ['a', {}, [['b', {}]]], ['a', {}, [[[[['b', {}]]]]]]);
    expect(a.outerHTML).toEqual('<a><b></b></a>');
  });

  test('will append given children', async ({ expect }) => {
    a = await updateElement(a, ['a', {}], ['a', {}, [['b', {}]]]);
    expect(a.outerHTML).toEqual('<a><b></b></a>');

    a = await updateElement(a, ['a', {}, [['b', {}]]], ['a', {}, [[['i', {}], [[[['i', {}]]]], [[[[['i', {}]]]]]]]]);
    expect(a.outerHTML).toEqual('<a><i></i><i></i><i></i></a>');
  });

  test('patch over function values', async ({ expect }) => {
    const Em = Array.prototype.concat.bind(['em']);

    function Del(props, children) {
      return ['del', {}, [[Em, props, children]]];
    }

    const $old = [[[Del, {}, 'OK']]];
    const $new = [[[[[Del, {}, [[['OSOM!']]]]]]]];

    createElement($old).mount(a);
    a = await updateElement(a, $old, $new);

    expect(a.innerHTML).toEqual('<del><em>OSOM!</em></del>');
    expect(div.innerHTML).toEqual('<a><del><em>OSOM!</em></del></a>');
    expect(body.innerHTML).toEqual('<div><a><del><em>OSOM!</em></del></a></div>');
  });

  test('should handle vnodes from factories', async ({ expect }) => {
    function T() {
      return ['b', {}];
    }

    await updateElement(a, ['a', {}], ['a', {}, [T]]);
    await updateElement(a, ['a', {}, [T]], ['a', {}, [T]]);
    await updateElement(a, ['a', {}, [T]], ['a', {}, [T]]);
    expect(a.outerHTML).toEqual('<a><b></b></a>');

    function T2() {
      return [['b', {}]];
    }

    await updateElement(a, ['a', {}, [T]], ['a', {}, [T2]]);
    await updateElement(a, ['a', {}, [T2]], ['a', {}, [T2]]);
    await updateElement(a, ['a', {}, [T2]], ['a', {}, [T2]]);
    expect(a.outerHTML).toEqual('<a><b></b></a>');
  });
});
