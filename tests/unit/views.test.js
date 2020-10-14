/* eslint-disable no-unused-expressions */

import td from 'testdouble';
import { expect } from 'chai';

import {
  createView,
  createThunk,
} from '../../src/lib/views';

import {
  onError,
  useRef,
  useMemo,
  useState,
  useEffect,
} from '../../src/lib/hooks';

import {
  bind, render, listeners,
} from '../../src';

import { tick, trim, format } from '../../src/lib/util';
import { bindHelpers as $$ } from '../../src/ssr';

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
      actions = { setFoo: value => async () => ({ foo: value }) };

      td.when(tag(td.matchers.isA(Object), td.matchers.isA(Object)))
        .thenReturn(['a']);
    });

    async function testThunk(value, result, subject, description) {
      const body = document.createElement('body');
      const app = createView(subject, { value }, [description]);
      const $ = app(body, bind(render, listeners()));

      await $$(body).withText(description).dispatch('click');

      expect($.target.outerHTML).to.eql(`<button>${description}</button><span>Got: ${result} (${result * 2})</span>`);
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

    it('should allow to subscribe/unsubscribe from state', async () => {
      const app = createView(tag, data, actions);
      const $ = app();

      let c = 0;
      let result;
      const done = $.subscribe(state => {
        result = state;
        c += 1;
      });

      expect(result).to.eql({ foo: 'BAR' });

      result = -1;
      await $.setFoo('OK');

      done();
      expect(result).to.eql({ foo: 'OK' });

      result = -1;
      await $.setFoo('X');

      expect(result).to.eql(-1);
      expect(c).to.eql(2);
    });

    it('should allow to capture context through hooks', async () => {
      const values = [1, 2, 3];
      const stack = [];

      let broke;
      function CounterView(props = {}) {
        const [value, setValue] = useState(props.value || Math.random());

        if (broke) useState();

        const [other, setOther] = useState('FIXME');
        const fixedValues = useMemo(() => values.slice(), []);
        const myValue = useMemo(() => fixedValues.pop(), [other]);
        const myRef = useRef();

        stack.push(myValue);

        useEffect(() => {
          stack.push('AFTER');

          return () => {
            stack.push('CLEAN');
            stack.push(myRef.current.tagName);
          };
        }, [other]);

        return [[['div', { ref: myRef }, [[
          ['button', { onclick: () => setValue(value - Math.random()) }, '--'],
          ['button', { onclick: () => setValue(value + Math.random()) }, '++'],
          ['button', { onclick: () => setOther(prompt('Value?')) }, 'ask'], // eslint-disable-line
          ['button', { onclick: () => setOther('OSOM') }, 'truth'],
          ['span', [['value: ', value, ', ', other]]],
        ]]]]];
      }

      const Counter = createView(CounterView);
      const counter = Counter({ value: 42 });

      const $ = bind(render, listeners());
      const app = counter(null, $);

      await $$(app.target).withText('truth').dispatch('click');

      expect(stack).to.eql([3, 2]);
      expect(app.target.outerHTML).to.contains('<span>value: 42, OSOM</span>');

      await tick();
      expect(stack).to.eql([3, 2, 'AFTER']);

      global.prompt = () => 'WAT';
      await $$(app.target).withText('ask').dispatch('click');

      expect(app.target.outerHTML).to.contains('<span>value: 42, WAT</span>');

      await tick();
      expect(stack).to.eql([3, 2, 'AFTER', 1, 'CLEAN', 'DIV', 'AFTER']);

      broke = true;
      await $$(app.target).withText('++').dispatch('click');

      let error;
      onError(e => { error = e; });

      await tick();
      expect(stack).to.eql([3, 2, 'AFTER', 1, 'CLEAN', 'DIV', 'AFTER', undefined]);
      expect(error.message).to.contains('Hooks must be called in a predictable way');
    });
  });

  describe('createThunk', () => {
    const $ = bind(render, listeners());

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
      ctx = createThunk([Main, { value: 42 }], $);
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
      let obj = $$(node).withText('++');

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
