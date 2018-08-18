import {
  patchDocument,
  patchWindow,
  dropDocument,
  dropWindow,
} from '../../../src/ssr/doc';

export default {
  enable() {
    patchDocument();
    patchWindow();
  },
  disable() {
    dropDocument();
    dropWindow();
  },
};
