/* eslint-disable no-unused-expressions */

import { expect } from 'chai';

import * as doc from '../../src/ssr/jsdom';
import { encodeText } from '../../src/ssr/doc';
import { bind, render } from '../../src';
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
      ['fragment', { id: 'test' }, [
        'OSOM',
      ]],
      '}',
    ]]);

    t = FragmentList.from('test');

    const div = $(['div', null, [
      ['fragment', { id: 'other', tag: 'p' }],
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
    expect(tree.outerHTML).to.contains('<div>{<x-fragment id="test">OSOM</x-fragment>}</div>');
  });

  it('should be able to append childNodes', async () => {
    document.body.appendChild(tree);
    t.append(['!', '?']);

    expect(tree.outerHTML).to.eql('<div>{<x-fragment id="test">OSOM!?</x-fragment>}</div>');
  });

  it('should be able to prepend childNodes', async () => {
    document.body.appendChild(tree);
    t.prepend(['.', '.', '.']);

    expect(tree.outerHTML).to.eql('<div>{<x-fragment id="test">...OSOM</x-fragment>}</div>');
  });

  it('should be able to change directions', async () => {
    document.body.appendChild(tree);
    t.prepend(['(', '[']);
    t.append([']', ')']);

    expect(t.vnode).to.eql(['(', '[', ['OSOM'], ']', ')']);
    expect(tree.outerHTML).to.eql('<div>{<x-fragment id="test">([OSOM])</x-fragment>}</div>');
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

    expect(tree.outerHTML).to.eql(`<div>{<x-fragment id="test">${sample}</x-fragment>}</div>`);
    expect(tree.childNodes.length).to.eql(3);

    let c = +(Math.random() * 10 + 1);
    while (c > 0) {
      // eslint-disable-next-line no-await-in-loop
      await t.update([]);
      c -= 1;
    }

    expect(tree.outerHTML).to.eql('<div>{<x-fragment id="test"></x-fragment>}</div>');
  });

  it('should work on already mounted nodes', async () => {
    await FragmentList.with('other', frag => {
      frag.prepend([['li', null, -1]]);
      frag.append([['li', null, 1]]);
      frag.append([['li', null, 2]]);
    });

    expect(document.body.outerHTML).to.eql('<body><div><p id="other"><li>-1</li><li>1</li><li>2</li></p></div></body>');
  });
});
