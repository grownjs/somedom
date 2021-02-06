/* eslint-disable no-unused-expressions */

import td from 'testdouble';
import { expect } from 'chai';
import {
  eventListener,
  invokeEvent,
  addEvents,
} from '../../src/lib/events';

import doc from '../../src/ssr/jsdom';

/* global beforeEach, afterEach, describe, it */

describe('events', () => {
  let div;
  let e;
  let cb;
  let hook;

  beforeEach(() => {
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

  afterEach(() => {
    doc.disable();
    td.reset();
  });

  describe('eventListener', () => {
    it('will call through hooked-nodes', () => {
      expect(eventListener(e)).to.eql('OK');
    });
  });

  describe('invokeEvent', () => {
    it('will skip missing or invalid globals', () => {
      invokeEvent(e, 'test', cb);
      invokeEvent(e, 'test', cb, { test: -1 });

      expect(td.explain(cb).callCount).to.eql(2);
    });

    it('will invoke global if is given as function', () => {
      invokeEvent(e, 'test', cb, hook);

      expect(td.explain(cb).callCount).to.eql(1);
      expect(td.explain(hook).callCount).to.eql(1);
    });

    it('will skip event-handlers if any globals return false', () => {
      td.when(hook('test', e))
        .thenReturn(false);

      invokeEvent(e, 'test', cb, hook);

      expect(td.explain(cb).callCount).to.eql(0);
      expect(td.explain(hook).callCount).to.eql(1);
    });

    it('will also works if globals is given as an object', () => {
      invokeEvent(e, 'test', cb, { test: hook });

      expect(td.explain(cb).callCount).to.eql(1);
      expect(td.explain(hook).callCount).to.eql(1);
    });
  });

  describe('addEvents', () => {
    it('should skip non valid functions', () => {
      addEvents(div, 'example');
      expect(div.events.example).to.be.undefined;
    });

    it('should attachs events on given nodes', () => {
      delete div.events;

      addEvents(div, 'ok', cb);
      expect(div.events).not.to.be.undefined;
    });

    it('should not register event-handlers twice', () => {
      delete div.events;

      addEvents(div, 'onclick', cb);
      addEvents(div, 'onclick', cb);

      expect(div.events.click.length).to.eql(1);
    });

    it('can detach events through the teardown() hook', () => {
      delete div.events;

      addEvents(div, 'onclick', cb);

      div.teardown();
      expect(div.events.click).to.eql([]);
    });

    it('will invoke attached events through a proxy-handler', () => {
      addEvents(div, 'onclick', cb);

      div.dispatchEvent(new Event('click'));

      expect(td.explain(cb).callCount).to.eql(1);
    });

    it('will hook given functions as event-handlers', () => {
      addEvents(div, 'example', cb);

      expect(typeof div.events.test).to.eql('function');
      expect(typeof div.events.example).to.eql('function');
    });

    it('will hook lifecycle-events as node-hooks', () => {
      addEvents(div, 'oncreate', cb);
      expect(typeof div.oncreate).to.eql('function');
    });
  });
});
