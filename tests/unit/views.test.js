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

import { trim, format } from '../../src/lib/util';
import { bindHelpers as $ } from '../../src/ssr';

import doc from './fixtures/document';

/* global beforeEach, afterEach, describe, it */

beforeEach(doc.enable);
afterEach(doc.disable);

describe('views', () => {
  let tag;

  describe('createView', () => {
    let data;
    let actions;

    beforeEach(() => {
      tag = td.func('render');
      data = { foo: 'BAR' };
      actions = { setFoo: value => async () => ({ foo: value }) };

      td.when(tag(td.matchers.isA(Object), td.matchers.isA(Object)))
        .thenReturn(['a']);
    });

    async function testThunk(value, result, subject, description) {
      const body = document.createElement('body');
      const app = createView(subject, { value }, [description]);
      const el = app(body, bind(render, listeners()));

      await $(body).withText(description).dispatch('click');

      expect(el.target.outerHTML).to.eql(`<button>${description}</button><span>Got: ${result} (${result * 2})</span>`);
    }

    it('can create views from plain objects', async () => {
      const Obj = {
        state: props => ({
          value: props.value || 42,
          result: null,
        }),

        render: (state, _actions, children) => [[
          ['button', { onclick: _actions.doStuff }, children],
          ['span', ['Got: ', state.result || '?', ' (', state.value, ')']],
        ]],

        doStuff: () => async ({ value }) => ({
          result: await Promise.resolve(value / 2),
        }),
      };

      await testThunk(42, 21, Obj, 'Click me.');
    });

    it('can create views from regular classes', async () => {
      await testThunk(16, 8, require('./fixtures/Thunk'), 'Click me.');
    });

    it('can be removed from the DOM calling unmount()', async () => {
      const app = createView(tag, data, actions);
      const el = app();

      await el.unmount();

      expect(document.body.innerHTML).to.eql('');
      expect(td.explain(tag).callCount).to.eql(1);
    });

    it('will render state-driven components', () => {
      const app = createView(tag, data, actions);
      const el = app();

      expect(el.target.outerHTML).to.eql('<a></a>');
      expect(td.explain(tag).callCount).to.eql(1);
    });

    it('should re-render on state changes', async () => {
      const app = createView(({ foo }) => [['a', foo]], data, actions);
      const el = app();

      expect(el.state).to.eql({ foo: 'BAR' });
      expect(el.target.outerHTML).to.eql('<a>BAR</a>');

      await el.setFoo('OK');

      expect(el.state).to.eql({ foo: 'OK' });
      expect(el.target.outerHTML).to.eql('<a>OK</a>');
    });

    it('should allow to subscribe/unsubscribe from state', async () => {
      const app = createView(tag, data, actions);
      const el = app();

      let c = 0;
      let result;
      const done = el.subscribe(state => {
        result = state;
        c += 1;
      });

      expect(result).to.eql({ foo: 'BAR' });

      result = -1;
      await el.setFoo('OK');

      done();
      expect(result).to.eql({ foo: 'OK' });

      result = -1;
      await el.setFoo('X');

      expect(result).to.eql(-1);
      expect(c).to.eql(2);
    });
  });

  describe('createThunk', () => {
    let MyCounter;
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

    function Main(props) {
      return ['fieldset', [[[['legend', 'Example:']], [[[[[MyCounter, props]]]]]]]];
    }

    beforeEach(() => {
      tag = bind(render, listeners());
      ctx = createThunk([Main, { value: 42 }], tag);
      MyCounter = ctx.wrap(CounterView);
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
      const node = ctx.render(ctx.vnode);

      expect(format(node.outerHTML)).to.eql(trim(`
        <fieldset>
          <legend>Example:</legend>
          <span>
            <button>--</button>
            <button>++</button>
            <span>value: 42</span>
          </span>
        </fieldset>
      `));

      let depth = 0;
      let obj = $(node).withText('++');

      while (obj.parentNode) {
        depth += 1;
        obj = obj.parentNode;
      }

      expect(depth).to.eql(2);
      expect(node.childNodes.length).to.eql(2);
      expect(node.childNodes[1].childNodes.length).to.eql(3);
    });

    it('should reference mounted views', async () => {
      await ctx.mount(document.createElement('body'));

      await ctx.refs.CounterView[0].setValue('OSOMS');
      expect(ctx.source.target.innerHTML).to.contains('value: OSOMS');
      expect(ctx.source.target.innerHTML).to.contains('<legend>Example:</legend><span><button>');

      await ctx.refs.CounterView[0].unmount();
      expect(ctx.source.target.innerHTML).to.eql('<legend>Example:</legend>');
      expect(ctx.refs.CounterView).to.be.undefined;
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
