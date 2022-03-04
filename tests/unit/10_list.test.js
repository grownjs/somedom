/* eslint-disable no-unused-expressions */

import { expect } from 'chai';

import doc from '../../src/ssr/jsdom';
import { encodeText } from '../../src/ssr/doc';
import { tick, bind, render } from '../../src';
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
      ['fragment', { key: 'test' }, [
        'OSOM',
      ]],
      '}',
    ]]);

    t = FragmentList['#test'];

    const div = $(['div', null, [
      ['fragment', { key: 'other' }],
    ]]);

    document.body.appendChild(div);
  });
  afterEach(() => {
    doc.disable();
    delete FragmentList['#test'];
  });

  it('should mount anchors as comments', async () => {
    expect(t.mounted).to.be.false;
    document.body.appendChild(tree);
    expect(t.mounted).to.be.true;
    expect(tree.outerHTML).to.contains('<div>{<!--#test/1-->}</div>');

    await tick();
    expect(t.length).to.eql(1);
    expect(tree.outerHTML).to.contains('<div>{<!--#test/1-->OSOM}</div>');
  });

  it('should be able to append childNodes', async () => {
    await tick();
    expect(t.length).to.eql(1);
    document.body.appendChild(tree);
    t.append(['!', '?']);

    expect(tree.outerHTML).to.eql('<div>{<!--#test/3-->OSOM!?}</div>');
    expect(t.length).to.eql(3);
  });

  it('should be able to prepend childNodes', async () => {
    await tick();
    expect(t.length).to.eql(1);
    document.body.appendChild(tree);
    t.prepend(['.', '.', '.']);

    expect(tree.outerHTML).to.eql('<div>{<!--#test/4-->...OSOM}</div>');
    expect(t.length).to.eql(4);
  });

  it('should be able to change directions', async () => {
    await tick();
    expect(t.length).to.eql(1);
    document.body.appendChild(tree);
    t.prepend(['(', '[']);
    t.append([']', ')']);

    expect(tree.outerHTML).to.eql('<div>{<!--#test/5-->([OSOM])}</div>');
  });

  it('should be able to update childNodes', async () => {
    await tick();
    expect(t.length).to.eql(1);
    document.body.appendChild(tree);

    t.prepend(['<', '[!CDATA[']);
    t.append([']]', '>']);
    await tick();

    let sample = '<[!CDATA[OSOM]]>';
    // why no escape this happy-dom?
    if (!process.env.HAPPY_DOM) {
      sample = encodeText(sample, false);
    }

    expect(tree.outerHTML).to.eql(`<div>{<!--#test/5-->${sample}}</div>`);
    expect(tree.childNodes.length).to.eql(8);

    let c = +(Math.random() * 10 + 1);
    while (c > 0) {
      // eslint-disable-next-line no-await-in-loop
      await t.update([]);
      c -= 1;
    }

    expect(tree.outerHTML).to.eql('<div>{<!--#test/0-->}</div>');
  });

  it('should prepend on already mounted nodes', async () => {
    await tick();
    await FragmentList.with('other', frag => {
      for (let i = 0; i < 3; i += 1) {
        frag.prepend([['li', null, i]]);
      }
    });

    expect(document.body.outerHTML).to.eql('<body><div><!--#other/3--><li>2</li><li>1</li><li>0</li></div></body>');
  });

  it('should append on already mounted nodes', async () => {
    await tick();
    await FragmentList.with('other', frag => {
      for (let i = 0; i < 3; i += 1) {
        frag.append([['li', null, i]]);
      }
    });

    expect(document.body.outerHTML).to.eql('<body><div><!--#other/3--><li>0</li><li>1</li><li>2</li></div></body>');
  });
});
