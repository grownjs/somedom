/* eslint-disable no-unused-expressions */

import td from 'testdouble';
import { expect } from 'chai';

import {
  createView,
} from '../../src/lib/views';

import {
  useRef,
  useMemo,
  useState,
  useEffect,
  getContext,
  withContext,
} from '../../src/lib/hooks';

import {
  bind, render, listeners,
} from '../../src';

import { bindHelpers as $ } from '../../src/ssr';
import Fragment from '../../src/lib/fragment';
import { tick } from '../../src/lib/util';
import doc from './fixtures/env';

/* global beforeEach, afterEach, describe, it */

describe('hooks', () => {
  beforeEach(doc.enable);
  afterEach(doc.disable);

  let scope;
  let sync;
  let view;

  beforeEach(() => {
    scope = null;
    sync = td.func('syncView');
    view = td.func('createView');

    td.when(sync())
      .thenResolve();

    td.when(view(td.matchers.isA(Function), td.matchers.isA(Function)))
      .thenDo((cb, fix) => cb(fix(sync)));
  });

  describe('withContext', () => {
    it('should create context on function calls', () => {
      withContext(() => {
        scope = getContext();
      }, view)();

      expect(td.explain(view).callCount).to.eql(1);
      expect(td.explain(sync).callCount).to.eql(0);

      expect(scope.hash).to.eql('0.0.0');
      expect(scope.set).to.eql(sync);
      expect(scope.key).to.eql(0);
      expect(scope.fx).to.eql(0);
      expect(scope.m).to.eql(0);
    });

    it('should handle context on nested calls', async () => {
      let a;
      let b;
      let c;

      function wrap(tag) {
        return (props, children) => {
          const target = new Fragment();
          tag(props, children)(target);
          return target;
        };
      }

      const C = wrap(withContext((props, children) => {
        a = useState(3);
        return [['c', props, [children, a[0]]]];
      }, createView));

      const B = wrap(withContext((props, children) => {
        b = useState(2);
        return [['b', null, [C, props, [children, b[0]]]]];
      }, createView));

      const A = wrap(withContext((props, children) => {
        c = useState(1);
        return [['a', null, [B, props, [children, c[0]]]]];
      }, createView));

      const div = document.createElement('div');
      const app = A(null, 0);
      app.mount(div);

      expect(div.innerHTML).to.eql('<a><b><c>0123</c></b></a>');

      await a[1]('0');
      await tick();

      expect(div.innerHTML).to.eql('<a><b><c>0120</c></b></a>');

      await b[1]('1');
      await tick();

      expect(div.innerHTML).to.eql('<a><b><c>0113</c></b></a>');

      await c[1]('2');
      await tick();

      expect(div.innerHTML).to.eql('<a><b><c>0223</c></b></a>');
    });

    it('should extend context through hooks', async () => {
      withContext(() => {
        const [value, setValue] = useState(42);

        setValue(value / 2);
      }, view)();

      sync = td.explain(sync);

      expect(sync.callCount).to.eql(1);
      expect(sync.calls[0].context.key).to.eql(1);
      expect(sync.calls[0].context.val).to.eql([21]);
      expect(sync.calls[0].context.hash).to.eql('1.0.0');
    });
  });

  describe('integration', () => {
    it('should allow to capture context through hooks', async () => {
      const values = [1, 2, 3];
      const stack = [];

      function CounterView(props = {}) {
        const [value, setValue] = useState(props.value || Math.random());
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
          ['span', null, [['value: ', value, ', ', other]]],
        ]]]]];
      }

      const Counter = createView(CounterView);
      const counter = Counter({ value: 42 });

      const tag = bind(render, listeners());
      const app = counter(null, tag);

      $(app.target).withText('truth').dispatchEvent(new Event('click'));
      await tick();

      expect(stack.join('.')).to.eql('3.AFTER.2.CLEAN.DIV.AFTER');
      expect(app.target.outerHTML).to.contains('<span>value: 42, OSOM</span>');

      global.prompt = () => 'WAT';

      $(app.target).withText('ask').dispatchEvent(new Event('click'));
      await tick();

      expect(stack.join('.')).to.eql('3.AFTER.2.CLEAN.DIV.AFTER.1.CLEAN.DIV.AFTER');
      expect(app.target.outerHTML).to.contains('<span>value: 42, WAT</span>');
    });
  });
});
