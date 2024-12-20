import * as td from 'testdouble';
import { test } from '@japa/runner';

import {
  eventListener,
  invokeEvent,
  addEvents,
} from '../../src/lib/events.js';

import doc from './fixtures/env.js';

let div;
let e;
let cb;
let hook;

function setup(t) {
  t.each.teardown(() => {
    doc.disable();
    td.reset();
  });
  t.each.setup(() => {
    doc.enable();
    div = document.createElement('div');
    div.events = { test: td.func('testEvent') };

    e = {
      currentTarget: div,
      type: 'test',
    };

    cb = td.func('callback');
    hook = td.func('globals');

    td.when(div.events.test(e))
      .thenReturn('OK');
  });
}

test.group('eventListener', t => {
  setup(t);

  test('will call through hooked-nodes', ({ expect }) => {
    expect(eventListener(e.type)(e)).toEqual('OK');
  });
});

test.group('invokeEvent', t => {
  setup(t);

  test('will skip missing or invalid globals', ({ expect }) => {
    invokeEvent(e, 'test', cb);
    invokeEvent(e, 'test', cb, { test: -1 });

    expect(td.explain(cb).callCount).toEqual(2);
  });

  test('will invoke global if is given as function', ({ expect }) => {
    invokeEvent(e, 'test', cb, hook);

    expect(td.explain(cb).callCount).toEqual(1);
    expect(td.explain(hook).callCount).toEqual(1);
  });

  test('will skip event-handlers if any globals return false', ({ expect }) => {
    td.when(hook('test', e))
      .thenReturn(false);

    invokeEvent(e, 'test', cb, hook);

    expect(td.explain(cb).callCount).toEqual(0);
    expect(td.explain(hook).callCount).toEqual(1);
  });

  test('will also works if globals is given as an object', ({ expect }) => {
    invokeEvent(e, 'test', cb, { test: hook });

    expect(td.explain(cb).callCount).toEqual(1);
    expect(td.explain(hook).callCount).toEqual(1);
  });
});

test.group('addEvents', t => {
  setup(t);

  test('should skip non valid functions', ({ expect }) => {
    addEvents(div, 'example');
    expect(div.events.example).toBeUndefined();
  });

  test('should attachs events on given nodes', ({ expect }) => {
    delete div.events;

    addEvents(div, 'ok', cb);
    expect(div.events).not.toBeUndefined();
  });

  test('should not register event-handlers twice', ({ expect }) => {
    delete div.events;

    addEvents(div, 'onclick', cb);
    addEvents(div, 'onclick', cb);

    expect(div.events.click.length).toEqual(1);
  });

  test('can detach events through the teardown() hook', ({ expect }) => {
    delete div.events;

    addEvents(div, 'onclick', cb);

    div.teardown();
    expect(div.events.click).toEqual([]);
  });

  test('will invoke attached events through a proxy-handler', ({ expect }) => {
    addEvents(div, 'onclick', cb);

    div.dispatchEvent(new Event('click'));

    expect(td.explain(cb).callCount).toEqual(1);
  });

  test('will hook given functions as event-handlers', ({ expect }) => {
    addEvents(div, 'example', cb);

    expect(typeof div.events.test).toEqual('function');
    expect(typeof div.events.example).toEqual('function');
  });

  test('will hook lifecycle-events as node-hooks', ({ expect }) => {
    addEvents(div, 'oncreate', cb);
    expect(typeof div.oncreate).toEqual('function');
  });
});
