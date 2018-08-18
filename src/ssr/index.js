import { isFunction, format } from '../lib/util';

import {
  patchDocument,
  patchWindow,
  dropDocument,
  dropWindow,
} from './doc';

export default async function renderToString(app, cb) {
  patchDocument();
  patchWindow();

  const ctx = app(document.createElement('div'));

  if (isFunction(cb)) await cb(ctx);

  try {
    return format(ctx.target.outerHTML);
  } finally {
    dropDocument();
    dropWindow();
  }
}
