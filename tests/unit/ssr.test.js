/* eslint-disable no-unused-expressions */

import { expect } from 'chai';

import { view } from '../../src';
import { trim } from '../../src/lib/util';

import renderToString from '../../src/ssr';

/* global describe, it */

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
    ['h1', state.count],
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
  it('should render mounted nodes as markup', async () => {
    const html = await renderToString(main());

    expect(html).to.eql(getMock(0));
  });

  it('can invoke actions before rendering', async () => {
    const nth = Math.round(Math.random() * 10) + 1;
    const html = await renderToString(main(), ctx => ctx.up(nth));

    expect(html).to.eql(getMock(nth));
  });
});
