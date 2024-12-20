import { expect } from '@japa/expect';
import {
  processCLIArgs, configure, test, run,
} from '@japa/runner';

const _group = test.group;

test.group = (desc, cb) => {
  _group(desc, group => {
    group.tap(t => {
      if (t.title.includes('skip:')) t.skip();
      if (t.title.includes('pin:')) t.pin();
    });
    cb(group);
  });
};

processCLIArgs(process.argv.slice(2));
configure({
  files: ['tests/unit/**/*.test.js'],
  plugins: [expect()],
  bail: true,
});
run();
