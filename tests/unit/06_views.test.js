/* eslint-disable no-unused-expressions */

import td from 'testdouble';
import { expect } from 'chai';

import {
  createView,
  createThunk,
  getDecorated,
} from '../../src/lib/views';

import {
  createElement,
} from '../../src/lib/node';

import {
  bind, render, listeners,
} from '../../src';

import Fragment from '../../src/lib/fragment';

import { tick, trim, format } from '../../src/lib/util';
import { bindHelpers as $ } from '../../src/ssr';
import doc from '../../src/ssr/jsdom';

/* global beforeEach, afterEach, describe, it */

describe('views', () => {
  beforeEach(doc.enable);
  afterEach(doc.disable);

  describe('getDecorated', () => {
    describe('objects', () => {
      it('should return wrapped objects as view params', () => {
        expect(getDecorated()).to.eql({
          Tag: undefined,
          state: undefined,
          actions: undefined,
          instance: undefined,
        });
      });

      it('should decorate objects if they have render()', () => {
        const view = getDecorated({
          render: () => null,
        });

        expect(view.actions).to.eql({});
        expect(typeof view.Tag).to.eql('function');
      });

      it('should wrap methods from given object as actions', () => {
        const callback = td.func('value');
        const view = getDecorated({
          constructor: () => null,
          render: () => null,
          value: callback,
          props: () => 0,
        });

        expect(view.actions.props).to.be.undefined;
        expect(view.actions.constructor).to.be.eql(Object);
        expect(typeof view.actions.value).to.eql('function');
        expect(view.actions.value).not.eql(callback);
        expect(td.explain(callback).callCount).to.eql(0);

        view.actions.value();
        expect(td.explain(callback).callCount).to.eql(1);
      });

      it('should call state() if it is a function', () => {
        const state = td.func('state');
        const result = Symbol('result');

        td.when(state(td.matchers.anything()))
          .thenReturn(result);

        const view = getDecorated({
          render: () => null,
          state,
        });

        expect(view.state).to.eql(result);
        expect(td.explain(state).callCount).to.eql(1);
      });

      it('should take given state otherwise, if any', () => {
        const view = getDecorated({
          render: () => null,
          state: { x: 42 },
        });

        expect(view.state).to.eql({ x: 42 });
      });

      it('should call render() if Tag factory is invoked', () => {
        const callback = td.func('render');
        const view = getDecorated({
          render: callback,
        });

        expect(view.Tag()).to.be.undefined;
        expect(td.explain(callback).callCount).to.eql(1);
      });
    });

    describe('classes', () => {
      let Test;

      beforeEach(() => {
        Test = require('./fixtures/class');
      });

      it('should return wrapped classes as view params', () => {
        expect(getDecorated(Test)).to.eql({
          Tag: Test,
          state: undefined,
          actions: undefined,
          instance: undefined,
        });
      });

      it('should decorate classes if they have render()', () => {
        Test.prototype.render = () => null;

        const view = getDecorated(Test);

        expect(view.actions).to.eql({});
      });

      it('should wrap methods from given class as actions', () => {
        const callback = Test.prototype.value = td.func('value');

        Test.prototype.constructor = () => null;
        Test.prototype.render = () => null;
        Test.prototype.props = () => null;
        Test.prototype._skip = () => 42;

        const view = getDecorated(Test);

        expect(view.actions.props).to.be.undefined;
        expect(view.actions.constructor).to.be.eql(Object);
        expect(typeof view.actions.value).to.eql('function');
        expect(view.actions.value).not.eql(callback);
        expect(td.explain(callback).callCount).to.eql(0);

        view.instance.value()();
        expect(view.instance._skip()).to.eql(42);
        expect(view.instance._skip).to.eql(Test.prototype._skip);
        expect(td.explain(callback).callCount).to.eql(1);
      });

      it('should call state() if it is a function', () => {
        const state = Test.prototype.state = td.func('state');
        const result = Symbol('result');

        Test.prototype.render = () => null;

        td.when(state(td.matchers.anything()))
          .thenReturn(result);

        const view = getDecorated(Test);

        expect(view.state).to.eql(result);
        expect(td.explain(state).callCount).to.eql(1);
        expect(td.explain(view.instance.state).callCount).to.eql(1);
      });

      it('should take given state otherwise, if any', () => {
        Test.prototype.render = () => null;
        Test.prototype.state = { x: 42 };

        const view = getDecorated(Test);

        Test.prototype.state = { x: -1 };
        expect(view.state).to.eql({ x: 42 });
        expect(view.instance.state).to.eql({ x: -1 });
      });

      it('should call render() if Tag factory is invoked', () => {
        const callback = Test.prototype.render = td.func('render');
        const view = getDecorated(Test);

        expect(view.Tag()).to.be.undefined;
        expect(td.explain(callback).callCount).to.eql(1);
      });
    });
  });

  describe('createView', () => {
    it('should fail if invalid actions are given', () => {
      expect(createView(() => null, null, { x: 42 })).to.throw(/Invalid action, given 42 \(x\)/);
    });

    it('should normalize arguments from given calls', async () => {
      const callback = td.func('render');
      const action = td.func('action');
      const actions = { fun: action };

      td.when(actions.fun()).thenReturn(() => ({ x: 42 }));
      td.when(actions.fun(-1)).thenReturn(() => ({ x: -1 }));
      td.when(actions.fun(42)).thenReturn(() => 'OSOM');
      td.when(actions.fun(1)).thenReturn(() => Promise.resolve('OSOM'));
      td.when(actions.fun(2)).thenReturn(() => Promise.resolve({ x: 2 }));

      td.when(callback(td.matchers.anything(), td.matchers.anything()))
        .thenDo(props => [JSON.stringify(props)]);

      const view = createView(callback, null, actions)();

      await view.defer(view.fun());
      expect(td.explain(callback).callCount).to.eql(2);
      expect(view.target.innerHTML).to.eql('{"x":42}');

      await view.defer(view.fun(-1));
      expect(td.explain(callback).callCount).to.eql(3);
      expect(view.target.innerHTML).to.eql('{"x":-1}');

      await view.defer(view.fun(42));
      expect(td.explain(callback).callCount).to.eql(3);

      await view.defer(view.fun(1));
      expect(td.explain(callback).callCount).to.eql(3);

      await view.defer(view.fun(2));
      expect(td.explain(callback).callCount).to.eql(4);
      expect(view.target.innerHTML).to.eql('{"x":2}');
    });

    it('should allow to mount views on Document fragments', () => {
      const callback = td.func('render');

      td.when(callback(td.matchers.anything(), td.matchers.anything()))
        .thenDo(props => [JSON.stringify(props)]);

      const _doc = document.createDocumentFragment();
      const view2 = createView(callback, null, [42])(_doc);

      expect(view2.target.nodeType).to.eql(11);
      expect(view2.target.root).to.be.undefined;
      expect(view2.target.childNodes[0].nodeValue).to.eql('{}');
    });

    it('should allow to update ViewFragments', async () => {
      let i = 0;
      const action = () => () => ({ value: i++ }); // eslint-disable-line
      const view = createView(props => ['b', props], null, { action });
      const app = view(document.body);

      expect(app.target.outerHTML).to.eql('<b></b>');
      await app.defer(app.action());

      expect(app.target.outerHTML).to.eql('<b value="0"></b>');

      await app.defer(app.action());
      expect(app.target.outerHTML).to.eql('<b value="1"></b>');

      await app.defer(app.action());
      expect(app.target.outerHTML).to.eql('<b value="2"></b>');
    });

    it('should allow to receive a refreshCallback', async () => {
      const callback = td.func('refreshCallback');

      let i = 42;
      td.when(callback(td.matchers.anything()))
        .thenDo(ok => ok({ value: i++ })); // eslint-disable-line

      const view = createView(props => [['a', props]], callback);
      const app = view(document.body);

      expect(i).to.eql(43);
      expect(app.state).to.eql({ value: 42 });
      expect(app.target).not.to.be.undefined;
      expect(app.target.innerHTML).to.eql('<a value="42"></a>');
      expect(td.explain(callback).callCount).to.eql(1);

      const view2 = createView(props => ['b', props], null, null, callback);
      const app2 = view2(document.body);

      expect(i).to.eql(44);
      expect(app2.state).to.eql({ value: 43 });
      expect(app2.target).not.to.be.undefined;
      expect(app2.target.outerHTML).to.eql('<b value="43"></b>');
      expect(td.explain(callback).callCount).to.eql(2);
    });

    it('should return wrapped views from given factories', () => {
      const tag = td.func('render');
      const props = {};
      const children = [];

      td.when(tag(props, children))
        .thenReturn({});

      expect(createView()).not.to.be.undefined;
      expect(createView(tag, null)).not.to.be.undefined;

      const app = createView(tag, null)();

      expect(td.explain(tag).callCount).to.eql(1);
      expect(app.target.childNodes.length).to.eql(0);
      expect(app.target.tagName).to.eql('BODY');
    });

    it('should call withContext() if only a function is given', () => {
      const view = createView(() => null);
      const el = view()();

      expect(typeof el.subscribe).to.eql('function');
      expect(typeof el.unmount).to.eql('function');
      expect(el.target.tagName).to.eql('BODY');
    });

    it('should allow to subscribe to state changes', async () => {
      const actions = { test: td.func('test') };
      const callback = td.func('callback');

      td.when(actions.test())
        .thenReturn(() => ({ x: 42 }));

      const view = createView(props => ['pre', null, JSON.stringify(props)], null, actions);
      const app = view();

      const teardown = app.subscribe(callback);
      await app.defer(app.test());

      expect(app.state).to.eql({ x: 42 });
      expect(app.target.innerHTML).to.eql('{"x":42}');

      await app.defer(app.test());
      expect(td.explain(callback).callCount).to.eql(2);

      teardown();
      await app.defer(app.test());
      expect(td.explain(callback).callCount).to.eql(2);
    });

    it('should overload class instances to proxy actions', async () => {
      function Class() {
      }

      Class.prototype.render = function $render() {
        return [['div', null, [this.state.value]]];
      };

      Class.prototype.update = function $update() {
        return { value: `${this.props.value}!` };
      };

      const view = createView(Class, { value: 'OSOM' });

      const el = view();

      expect(el.instance.update()).to.eql({ value: 'OSOM!' });

      await tick();
      expect(el.target.innerHTML).to.eql('<div>OSOM!</div>');
    });

    it('should call destroyElement() as result of unmount() calls', async () => {
      const view = createView(() => ['div', null, 'OK'], null);
      const app = view();

      expect(document.body.innerHTML).to.eql('<div>OK</div>');

      await app.unmount();
      expect(document.body.innerHTML).to.eql('');
    });

    describe('integration', () => {
      let tag;
      let data;
      let actions;

      beforeEach(() => {
        tag = td.func('render');
        data = { foo: 'BAR' };
        actions = { setFoo: value => async () => ({ foo: value }) };

        td.when(tag(td.matchers.isA(Object), td.matchers.anything()))
          .thenReturn(['a', null]);
      });

      async function testThunk(value, result, subject, description) {
        const body = document.createElement('body');
        const app = createView(subject, { value }, [description]);
        const el = app(body, bind(render, listeners()));

        $(body).withText(description).dispatch('click');
        await tick();

        expect(el.target.innerHTML).to.eql(`<button>${description}</button><span>Got: ${result} (${result * 2})</span>`);
      }

      it('can create views from plain objects and classes', async () => {
        const Obj = {
          state: props => ({
            value: props.value || 42,
            result: null,
          }),

          render: (state, _actions, children) => [[
            ['button', { onclick: _actions.doStuff }, children],
            ['span', null, ['Got: ', state.result || '?', ' (', state.value, ')']],
          ]],

          doStuff: () => async ({ value }) => ({
            result: await Promise.resolve(value / 2),
          }),
        };

        await testThunk(42, 21, Obj, 'Click me.');
        await testThunk(16, 8, require('./fixtures/Thunk'), 'Click me.');
      });

      it('will render state-driven components', () => {
        const app = createView(tag, data, actions);
        const el = app();

        expect(el.target.outerHTML).to.eql('<a></a>');
        expect(td.explain(tag).callCount).to.eql(1);
      });

      it('should re-render on state changes', async () => {
        const app = createView(({ foo }) => [['a', null, foo]], data, actions);
        const el = app();

        expect(el.state).to.eql({ foo: 'BAR' });
        expect(el.target.innerHTML).to.eql('<a>BAR</a>');

        await el.setFoo('OK');

        expect(el.state).to.eql({ foo: 'OK' });
        expect(el.target.innerHTML).to.eql('<a>OK</a>');
      });
    });
  });

  describe('createThunk', () => {
    let thunk;

    beforeEach(() => {
      thunk = createThunk();
    });

    it('should return given views as thunks', () => {
      expect(thunk.refs).to.eql({});
      expect(thunk.source).to.be.null;
      expect(thunk.render).to.eql(createElement);
      expect(thunk.vnode).to.eql(['div', null]);
      expect(typeof thunk.thunk).to.eql('function');
      expect(typeof thunk.wrap).to.eql('function');
      expect(typeof thunk.mount).to.eql('function');
      expect(typeof thunk.unmount).to.eql('function');
    });

    it('should call unmount() before mounting', async () => {
      thunk.unmount = td.func('unmount');

      await thunk.mount();
      expect(td.explain(thunk.unmount).callCount).to.eql(1);
    });

    it('should invoke its view on mount() calls', async () => {
      thunk.thunk = td.func('thunk');

      td.when(thunk.thunk(td.matchers.anything(), thunk.render))
        .thenReturn(42);

      await thunk.mount();
      expect(thunk.source).to.eql(42);
      expect(td.explain(thunk.thunk).callCount).to.eql(1);
    });

    it('should call destroyElement() on unmounting', async () => {
      const callback = td.func('remove');

      thunk.source = { target: document.createElement('div') };
      thunk.source.target.remove = callback;

      await thunk.mount();
      expect(td.explain(callback).callCount).to.eql(1);
    });

    it('should wrap given views as factories on the thunk', async () => {
      expect(thunk.wrap).to.throw(/Expecting a view factory, given 'undefined'/);

      const callback = td.func('remove');
      const view = td.func('thunk');
      const tag = td.func('render');

      td.when(tag(td.matchers.anything(), td.matchers.anything()))
        .thenReturn(view);

      td.when(view(td.matchers.anything(), td.matchers.anything()))
        .thenDo(target => {
          target.remove = callback;
          return { target };
        });

      const el = thunk.wrap(tag, 'Test')();

      expect(Fragment.valid(el)).to.be.true;
      expect(thunk.refs.Test[0].target).to.eql(el);

      await thunk.unmount();
      expect(thunk.refs).to.eql({});
    });

    it('should derive the thunk name from the given factory', () => {
      const callback = td.func('mount');

      td.when(callback(td.matchers.isA(Fragment), thunk.render))
        .thenDo(target => ({ target }));

      thunk.wrap(function Test() {
        return callback;
      })();

      expect(thunk.refs.Test).not.to.be.undefined;
      expect(td.explain(callback).callCount).to.eql(1);

      thunk.wrap(() => callback, 'FIXME')();
      expect(thunk.refs.FIXME).not.to.be.undefined;
    });

    it('should unregister single thunks if they are multiple', async () => {
      const callback = td.func('remove');

      function wrap(target) {
        target.remove = callback;
        return { target };
      }

      thunk.wrap(() => wrap)();
      thunk.wrap(() => wrap)();

      await thunk.refs.Thunk[0].target.remove();
      expect(thunk.refs.Thunk.length).to.eql(1);
    });

    describe('integration', () => {
      let MyCounter;
      let tag;
      let ctx;

      function CounterView(props = {}) {
        return createView(({ value }, { setValue }) => ['span', null, [
          ['button', { onclick: () => setValue(value - Math.random()) }, '--'],
          ['button', { onclick: () => setValue(value + Math.random()) }, '++'],
          ['span', null, ['value: ', value]],
        ]], {
          value: props.value || Math.random(),
        }, {
          setValue: value => () => ({ value }),
        });
      }

      function Main(props) {
        return ['fieldset', null, [[[['legend', null, ['Example:']]], [[[[[MyCounter, props]]]]]]]];
      }

      beforeEach(() => {
        tag = bind(render, listeners());
        ctx = createThunk([Main, { value: 42 }], tag);
        MyCounter = ctx.wrap(CounterView);
      });

      it('should render plain views', async () => {
        const view = new CounterView({ value: 42 });
        const app = view();

        await app.defer(app.setValue(-1));
        expect(app.target.outerHTML).to.not.contains('<span>value: Infinity</span>');
        expect(app.target.outerHTML).to.contains('<span>value: -1</span>');

        await app.defer(app.setValue(Infinity));
        expect(app.target.outerHTML).to.not.contains('<span>value: -1</span>');
        expect(app.target.outerHTML).to.contains('<span>value: Infinity</span>');
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
        expect(node.childNodes.length).to.eql(4);
        expect(node.childNodes[2].childNodes.length).to.eql(3);
      });

      it('should reference mounted views', async () => {
        await ctx.mount(document.createElement('body'));

        await ctx.defer(ctx.refs.CounterView[0].setValue('OSOMS'));
        expect(ctx.source.target.innerHTML).to.contains('value: OSOMS');
        expect(ctx.source.target.innerHTML).to.contains('<legend>Example:</legend><span><button>');

        await ctx.defer(ctx.refs.CounterView[0].unmount());
        expect(ctx.source.target.innerHTML).to.eql('<legend>Example:</legend>');
        expect(ctx.refs.CounterView).to.be.undefined;
      });

      it('should unmount already mounted views', async () => {
        const body = document.createElement('body');
        const ondestroy = td.func('ondestroy');
        const vnode = ['div', { ondestroy }];

        await ctx.mount(body, vnode);
        await ctx.mount(body, vnode);
        await ctx.patch(body, vnode, []);

        expect(td.explain(ondestroy).callCount).to.eql(2);
      });

      it('should patch fragments from views', async () => {
        const { view } = bind(render, listeners());
        const seq = Array.from({ length: Math.random() * 10 + 1 })
          .map((_, i) => Math.random() * 10 + i | 0); // eslint-disable-line

        let inc = 0;
        const Other = view(function Random() {
          return ['OK: ', ...seq, inc++].concat(inc === 2 ? -1 : []); // eslint-disable-line
        });

        const Counter = createView(class CounterView2 {
          constructor() {
            this.children = [Other];
            this.state = { value: 42 };
          }

          inc() {
            return { value: this.state.value + 1 };
          }

          render() {
            return [
              ['p', null, [
                ['span', null, ['value: ', this.state.value]],
              ]],
              this.children,
            ];
          }
        });

        const div = document.createElement('div');
        const app = Counter(div);
        const prefix = seq.join('');

        expect(div.outerHTML).to.eql(`<div><p><span>value: 42</span></p>OK: ${prefix}0</div>`);
        expect(app.target.outerHTML).to.eql(`<div><p><span>value: 42</span></p>OK: ${prefix}0</div>`);

        expect(inc).to.eql(1);
        await app.defer(app.instance.inc());
        const a = div.outerHTML;

        expect(inc).to.eql(2);
        await app.defer(app.instance.inc());
        const b = div.outerHTML;

        expect(inc).to.eql(3);
        await app.defer(app.instance.inc());
        const c = div.outerHTML;

        expect(inc).to.eql(4);
        expect(a).to.eql(`<div><p><span>value: 43</span></p>OK: ${prefix}1-1</div>`);
        expect(b).to.eql(`<div><p><span>value: 44</span></p>OK: ${prefix}2</div>`);
        expect(c).to.eql(`<div><p><span>value: 45</span></p>OK: ${prefix}3</div>`);
      });
    });
  });
});
