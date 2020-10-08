/* eslint-disable no-unused-expressions */

import td from 'testdouble';
import { expect } from 'chai';

import {
  createView,
  createThunk,
} from '../../src/lib/views';

import {
  bind, render, listeners,
} from '../../src';

import doc from './fixtures/document';

/* global beforeEach, afterEach, describe, it */

beforeEach(doc.enable);
afterEach(doc.disable);

describe('thunks', () => {
  describe('createView', () => {
    let tag;
    let data;
    let actions;

    beforeEach(() => {
      tag = td.func('render');
      data = { foo: 'BAR' };
      actions = { setFoo: value => () => ({ foo: value }) };

      td.when(tag(td.matchers.isA(Object), td.matchers.isA(Object)))
        .thenReturn(['a']);
    });

    it('can be removed from the DOM calling unmount()', async () => {
      const app = createView(tag, data, actions);
      const $ = app();

      await $.unmount();

      expect(document.body.innerHTML).to.eql('');
      expect(td.explain(tag).callCount).to.eql(1);
    });

    it('will render state-driven components', () => {
      const app = createView(tag, data, actions);
      const $ = app();

      expect($.target.outerHTML).to.eql('<a></a>');
      expect(td.explain(tag).callCount).to.eql(1);
    });

    it('should re-render on state changes', async () => {
      const app = createView(({ foo }) => [['a', foo]], data, actions);
      const $ = app();

      expect($.state).to.eql({ foo: 'BAR' });
      expect($.target.outerHTML).to.eql('<a>BAR</a>');

      await $.setFoo('OK');

      expect($.state).to.eql({ foo: 'OK' });
      expect($.target.outerHTML).to.eql('<a>OK</a>');
    });
  });

  describe('createThunk', () => {
    const $ = bind(render, listeners());

    let ctx;

    function CounterView(props = {}) {
      return createView(({ value }, { setValue }) => ['span', [
        ['button', { onclick: () => setValue(value - Math.random()) }, '--'],
        ['button', { onclick: () => setValue(value + Math.random()) }, '++'],
        ['span', ['value: ', value]],
      ]], {
        value: props.value || Math.random(),
      }, {
        setValue: value => () => ({ value }),
      });
    }

    function MyCounter(props) {
      return ctx.wrap(CounterView, ['div', props]);
    }

    function Main(props) {
      return ['fieldset', [['legend', 'Example:'], [MyCounter, props]]];
    }

    beforeEach(() => {
      ctx = createThunk([Main, { value: 42 }], $);
    });

    it('should render plain views', async () => {
      const view = new CounterView({ value: 42 });
      const app = view();

      await app.setValue(-1);
      expect(app.target.outerHTML).to.contains('value: -1');

      await app.setValue(Infinity);
      expect(app.target.outerHTML).to.contains('value: Infinity');
    });

    it('should render wrapped views', () => {
      expect(ctx.render(ctx.vnode).outerHTML).to.contains('value: 42');
    });

    it('should reference mounted views', async () => {
      await ctx.mount(document.createElement('body'));

      await ctx.refs.CounterView[0].setValue('OSOMS');
      expect(ctx.source.target.innerHTML).to.contains('value: OSOMS');

      await ctx.refs.CounterView[0].unmount();
      expect(ctx.source.target.innerHTML).to.eql('<legend>Example:</legend><div></div>');

      await ctx.refs.CounterView[0].target.parentNode.remove();
      expect(ctx.source.target.innerHTML).to.eql('<legend>Example:</legend>');
    });

    it('should unmount already mounted views', async () => {
      const body = document.createElement('body');
      const ondestroy = td.func('ondestroy');
      const vnode = ['div', { ondestroy }];

      await ctx.mount(body, vnode);
      await ctx.mount(body, vnode);

      expect(td.explain(ondestroy).callCount).to.eql(1);
    });
  });
});
