/* istanbul ignore file */

import { Window } from 'happy-dom';

import {
  patchDocument,
  patchWindow,
  dropDocument,
  dropWindow,
} from './doc';

export {
  bindHelpers,
} from './doc';

export * from '..';

function enable() {
  if (process.env.USE_JSDOM) {
    const window = new Window();

    global.document = window.document;
    global.window = window;
    global.Event = window.Event;
  } else {
    patchDocument();
    patchWindow();
  }
}

function disable() {
  if (process.env.USE_JSDOM) {
    delete global.document;
    delete global.window;
  } else {
    dropDocument();
    dropWindow();
  }
}

export default { enable, disable };
