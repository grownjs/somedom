/* eslint-disable no-unused-expressions */

import td from 'testdouble';
import { expect } from 'chai';

import {
  createView,
} from '../../src/lib/views';

import {
  onError,
  useRef,
  useMemo,
  useState,
  useEffect,
  createContext,
} from '../../src/lib/hooks';

import {
  bind, render, listeners,
} from '../../src';

import {
  getContext,
} from '../../src/lib/ctx';

import { tick } from '../../src/lib/util';
import { bindHelpers as $ } from '../../src/ssr';

import doc from './fixtures/document';

/* global beforeEach, afterEach, describe, it */

describe.only('hooks', () => {
  beforeEach(doc.enable);
  afterEach(doc.disable);

  let scope;
  let error;
  let sync;
  let view;

  beforeEach(() => {
    scope = null;
    error = null;
    sync = td.func('syncView');
    view = td.func('createView');

    td.when(sync())
      .thenResolve();

    td.when(view(td.matchers.isA(Function), td.matchers.isA(Function)))
      .thenDo((cb, fix) => cb(fix(sync)));
  });

  describe('createContext', () => {
    it('should fail on calling hooks without context', () => {
      try {
        getContext();
      } catch (e) {
        error = e;
      }

      expect(error.message).to.eql('Cannot call getContext() outside views');
    });

    it('should rethrow errors during instantiation', () => {
      expect(createContext(() => {
        throw new Error('FIXME');
      }, view)).to.throw('View: FIXME');
    });

    it('should create context on function calls', () => {
      createContext(() => {
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
          const target = document.createDocumentFragment();
          tag(props, children)(target);
          return target;
        };
      }

      const C = wrap(createContext((props, children) => {
        a = useState(3);
        return ['c', props, [children, a[0]]];
      }, createView));

      const B = wrap(createContext((props, children) => {
        b = useState(2);
        return ['b', [[C, props, [children, b[0]]]]];
      }, createView));

      const A = wrap(createContext((props, children) => {
        c = useState(1);
        return ['a', [[B, props, [children, c[0]]]]];
      }, createView));

      document.body.appendChild(A(null, 0));
      expect(document.body.innerHTML).to.eql('<a><b><c>0123</c></b></a>');

      a[1]('0');
      await tick();
      expect(document.body.innerHTML).to.eql('<a><b><c>0120</c></b></a>');

      b[1]('1');
      await tick();
      expect(document.body.innerHTML).to.eql('<a><b><c>0113</c></b></a>');

      c[1]('2');
      await tick();
      expect(document.body.innerHTML).to.eql('<a><b><c>0223</c></b></a>');
    });

    it('should extend context through hooks', async () => {
      createContext(() => {
        const [value, setValue] = useState(42);

        setValue(value / 2);
      }, view)();

      await tick();

      sync = td.explain(sync);

      expect(sync.callCount).to.eql(1);
      expect(sync.calls[0].context.key).to.eql(1);
      expect(sync.calls[0].context.val).to.eql([21]);
      expect(sync.calls[0].context.hash).to.eql('1.0.0');
    });
  });

  describe('onError()', () => {
    it('should help to capture failures', async () => {
      const app = createContext(() => {
        const [value, setValue] = useState(42);

        onError(e => {
          error = e;
        });

        if (value === 21) useState(-1);
        if (value === 42) setValue(value / 2);

        return value;
      }, createView)();

      app();
      await tick();
      await tick();

      expect(error.message).to.contains('Hooks must be called in a predictable way');
    });

    it('should raise failures otherwise', async () => {
      function callback(e) {
        error = e;
      }

      const app = await createContext(() => {
        useEffect(() => {
          process.on('unhandledRejection', callback);
          return () => {
            process.off('unhandledRejection', callback);
          };
        });

        useEffect(() => {
          throw new Error('WAT');
        });

        return 42;
      }, createView)();

      app();
      await tick();
      expect(error.message).to.eql('WAT');
      expect(document.body.innerHTML).to.eql('42');
    });
  });

  describe('useRef()', () => {
    it('should allow to capture references', async () => {
      const refs = [];

      createContext(() => {
        const ref = useRef();
        refs.push(ref, useRef(-1));
        return ['span', { ref }];
      }, createView)()();

      expect(refs[1].current).to.eql(-1);
      expect(refs[0].current.outerHTML).to.eql('<span></span>');
    });
  });

  describe('useMemo()', () => {
    it('should return same value on unchanged deps', async () => {
      const callback = td.func('truth');

      td.when(callback())
        .thenReturn(42);

      createContext(() => {
        const test = useMemo(callback, []);
        const [value, setValue] = useState(42);

        if (value === 42) setValue(value / 2);
        return test * value;
      }, createView)()();

      await tick();
      expect(document.body.innerHTML).to.eql('882');
      expect(td.explain(callback).callCount).to.eql(1);
    });
  });

  describe('useState()', () => {
    it('should allow to manage state within context', async () => {
      const app = createContext(() => {
        const [value, setValue] = useState(42);

        if (value === 21) setValue('OSOM');
        if (value === 42) setValue(value / 2);

        return value;
      }, createView)();

      app();
      await tick();

      expect(document.body.innerHTML).to.eql('OSOM');
    });
  });

  describe('useEffect()', () => {
    it('should allow to trigger effects after render', async () => {
      const callback = td.func('fx');
      const app = createContext(() => {
        useEffect(callback);
        return 'OSOM';
      }, createView)();

      app();
      await tick();
      expect(document.body.innerHTML).to.eql('OSOM');
      expect(td.explain(callback).callCount).to.eql(1);
    });

    it('should skip callback if the input does not change', async () => {
      const callback = td.func('fx');
      const app = createContext(() => {
        const [value, setValue] = useState(3);
        if (value > 1) setValue(value - 1);
        useEffect(callback, []);
        return value;
      }, createView)();

      app();
      await tick();
      expect(document.body.innerHTML).to.eql('1');
      expect(td.explain(callback).callCount).to.eql(1);
    });

    it('should trigger teardown callbacks if input changes', async () => {
      const teardown = td.func('end');
      const callback = td.func('fx');

      td.when(callback())
        .thenReturn(teardown);

      const app = createContext(() => {
        const [value, setValue] = useState(3);
        if (value > 0) setValue(value - 1);
        useEffect(callback, [value]);
        return value;
      }, createView)();

      app();
      await tick();
      expect(document.body.innerHTML).to.eql('0');
      expect(td.explain(teardown).callCount).to.eql(3);
      expect(td.explain(callback).callCount).to.eql(4);
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
          ['span', [['value: ', value, ', ', other]]],
        ]]]]];
      }

      const Counter = createView(CounterView);
      const counter = Counter({ value: 42 });

      const tag = bind(render, listeners());
      const app = counter(null, tag);

      await $(app.target).withText('truth').dispatch('click');

      expect(stack.join('.')).to.eql('3.AFTER.2.CLEAN.DIV.AFTER');
      expect(app.target.outerHTML).to.contains('<span>value: 42, OSOM</span>');

      global.prompt = () => 'WAT';

      await $(app.target).withText('ask').dispatch('click');

      expect(stack.join('.')).to.eql('3.AFTER.2.CLEAN.DIV.AFTER.1.CLEAN.DIV.AFTER');
      expect(app.target.outerHTML).to.contains('<span>value: 42, WAT</span>');
    });
  });
});
