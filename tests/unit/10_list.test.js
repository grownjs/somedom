/* eslint-disable no-unused-expressions */

import { expect } from 'chai';

import doc from '../../src/ssr/jsdom';
import { tick, bind, render } from '../../src';
import FragmentList from '../../src/lib/fragment-list';

/* global beforeEach, afterEach, describe, it */

const ctx = {};
const $ = bind(render, [{
  fragment: (props, children) => {
    return FragmentList.from(props || {}, children, $, ctx).target;
  },
}]);

describe('FragmentList', () => {
  let tree;
  beforeEach(() => {
    doc.enable();
    tree = $(['div', null, [
      ['fragment', { key: 'test' }, [
        'OSOM',
      ]],
    ]]);
  });
  afterEach(() => {
    doc.disable();
  });

  it('should mount fragments as comments', () => {
    expect(tree.outerHTML).to.contains('<div><!--#test--></div>');
    expect(Object.keys(ctx.blocks).length).to.eql(1);
  });

  it.skip('should handle fragment nodes as expected', async () => {
    expect(FragmentList.has('test')).to.be.false;

    const List = ctx.blocks.test.instance.mount(document.body);

    await tick(100);

    if (!ctx.blocks.test.instance.target.isConnected) {
      ctx.blocks.test.instance.target.isConnected = true;
      ctx.blocks.test.instance.target.parentNode.isConnected = true;
    }

    expect(FragmentList.has('test')).to.be.true;

    await FragmentList.with('test', t => {
      expect(t === List).to.be.true;
    });
  });
});
