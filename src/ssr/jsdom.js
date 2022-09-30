/* istanbul ignore file */

import {
  patchDocument,
  patchWindow,
  dropDocument,
  dropWindow,
} from './doc';

export {
  bindHelpers,
} from './doc';

export * from '../index';

export function enable() {
  if (process.env.JS_DOM || process.env.HAPPY_DOM) {
    let window;
    if (process.env.HAPPY_DOM) {
      const { Window } = require('happy-dom');
      window = new Window();
    } else {
      const { JSDOM } = require('jsdom');
      ({ window } = new JSDOM());
    }

    global.document = window.document;
    global.window = window;
    global.Event = window.Event;
  } else {
    patchDocument();
    patchWindow();
  }
}

export function disable() {
  if (process.env.JS_DOM || process.env.HAPPY_DOM) {
    delete global.document;
    delete global.window;
    delete global.Event;
  } else {
    dropDocument();
    dropWindow();
  }
}
