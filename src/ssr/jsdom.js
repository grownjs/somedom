/* istanbul ignore file */

import { JSDOM } from 'jsdom';

import {
  patchDocument,
  patchWindow,
  dropDocument,
  dropWindow,
} from './doc';

export default {
  enable() {
    if (process.env.USE_JSDOM) {
      const { window } = new JSDOM('');
      const { document } = window;
      global.document = document;
      global.window = window;
      global.Event = window.Event;
    } else {
      patchDocument();
      patchWindow();
    }
  },
  disable() {
    if (process.env.USE_JSDOM) {
      delete global.document;
      delete global.window;
    } else {
      dropDocument();
      dropWindow();
    }
  },
};
