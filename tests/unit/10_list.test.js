/* eslint-disable no-unused-expressions */

import { expect } from 'chai';
import td from 'testdouble';

import doc from './fixtures/env';
import { bind, render } from '../../src';
import { encodeText } from '../../src/ssr/doc';
import { updateElement } from '../../src/lib/node';
import FragmentList from '../../src/lib/fragment-list';

/* global beforeEach, afterEach, describe, it */

const $ = bind(render, [{
  fragment: (props, children) => {
    return FragmentList.from(props || {}, children, $).target;
  },
}]);

describe('FragmentList', () => {
  let t;
  let tree;
  beforeEach(() => {
    doc.enable();
    tree = $(['div', null, [
      '{',
      ['fragment', { name: 'test' }, [
        'OSOM',
      ]],
      '}',
    ]]);

    t = FragmentList.from('test');

    const div = $(['div', null, [
      ['fragment', { name: 'other', tag: 'p' }],
      ['ul', { 'data-fragment': 'test' }, []],
    ]]);

    document.body.appendChild(div);
  });
  afterEach(() => {
    doc.disable();
    FragmentList.del('test');
  });

  it('should behave as regular elements', async () => {
    expect(t.mounted).to.be.false;
    document.body.appendChild(tree);
    expect(t.mounted).to.be.true;
    expect(tree.outerHTML).to.contains('<div>{<x-fragment name="test">OSOM</x-fragment>}</div>');
  });

  it('should be able to append childNodes', async () => {
    document.body.appendChild(tree);
    t.append(['!', '?']);

    expect(tree.outerHTML).to.eql('<div>{<x-fragment name="test">OSOM!?</x-fragment>}</div>');
  });

  it('should be able to prepend childNodes', async () => {
    document.body.appendChild(tree);
    t.prepend(['.', '.', '.']);

    expect(tree.outerHTML).to.eql('<div>{<x-fragment name="test">...OSOM</x-fragment>}</div>');
  });

  it('should be able to change directions', async () => {
    document.body.appendChild(tree);
    t.prepend(['(', '[']);
    t.append([']', ')']);

    expect(t.vnode).to.eql(['(', '[', ['OSOM'], ']', ')']);
    expect(tree.outerHTML).to.eql('<div>{<x-fragment name="test">([OSOM])</x-fragment>}</div>');
  });

  it('should be able to update childNodes', async () => {
    document.body.appendChild(tree);

    t.prepend(['<', '[!CDATA[']);
    t.append([']]', '>']);

    let sample = '<[!CDATA[OSOM]]>';
    // why no escape this happy-dom?
    if (!process.env.HAPPY_DOM) {
      sample = encodeText(sample, false);
    }

    expect(tree.outerHTML).to.eql(`<div>{<x-fragment name="test">${sample}</x-fragment>}</div>`);
    expect(tree.childNodes.length).to.eql(3);

    let c = +(Math.random() * 10 + 1);
    while (c > 0) {
      // eslint-disable-next-line no-await-in-loop
      await t.update([]);
      c -= 1;
    }

    expect(tree.outerHTML).to.eql('<div>{<x-fragment name="test"></x-fragment>}</div>');
  });

  it('should work on already mounted nodes', async () => {
    const off = td.func('teardown');

    await FragmentList.with('other', frag => {
      frag.prepend([['li', null, -1]]);
      return off;
    });

    await FragmentList.with('other', frag => {
      frag.append([['li', null, 1]]);
      frag.append([['li', null, 2]]);
    });

    expect(FragmentList.has('other')).to.be.true;
    expect(FragmentList.has('undef')).to.be.false;

    const node = document.body.querySelector('ul[data-fragment]');
    const frag = FragmentList.from(node, [], $);

    frag.append([['li', null, 'OSOM']]);
    frag.append([['li', null, 'SO']]);

    FragmentList.stop();

    expect(td.explain(off).callCount).to.eql(1);

    expect(document.body.outerHTML).to.contains('<body><div><p name="other"><li>-1</li><li>1</li><li>2</li></p>');
    expect(document.body.outerHTML).to.contains('<ul data-fragment="test"><li>OSOM</li><li>SO</li></ul></div></body>');
  });

  it('should warn if children are not valid', async () => {
    expect(() => FragmentList.from({ name: 'test' }, ['b', null, 'OK'])).to.throw(/Fragments should be lists of nodes, given '\["b",null,"OK"]/);
  });

  it('should handle node-patches on its elements', async () => {
    const frag = FragmentList.from({ name: 'sample' }, [['b', null, 'OSOM']]);

    expect(frag.target.outerHTML).to.eql('<x-fragment name="sample"><b>OSOM</b></x-fragment>');
    await updateElement(frag.target, [['b', null, 'OSOM']], [['em', null, 'COOL']]);

    expect(frag.target.outerHTML).to.eql('<x-fragment name="sample"><em>COOL</em></x-fragment>');

    await frag.sync([['p', null, 'OK']]);
    expect(frag.target.outerHTML).to.eql('<x-fragment name="sample"><p>OK</p></x-fragment>');
  });
});
