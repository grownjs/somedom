import { enable, disable } from '../../../src/ssr/index';

export default {
  enable: () => {
    const env = {};

    if (process.env.HAPPY_DOM) {
      env.happydom = require('happy-dom');
    } else if (process.env.JS_DOM) {
      env.jsdom = require('jsdom');
    }
    enable(env);
  },
  disable,
};
