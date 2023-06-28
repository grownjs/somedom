import happyDOM from 'happy-dom';
import jsDOM from 'jsdom';

import { enable, disable } from '../../../src/ssr/index.js';

export default {
  enable: () => {
    const env = {};

    if (process.env.HAPPY_DOM) {
      env.happydom = happyDOM;
    } else if (process.env.JS_DOM) {
      env.jsdom = jsDOM;
    }
    enable(env);
  },
  disable,
};
