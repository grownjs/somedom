import * as somedom from '../../src';
import { trim as format } from '../../src/lib/util';

function summarize(script) {
  const { innerHTML, parentNode } = script;

  const code = innerHTML
    .replace(/( +)appendChild\(([^;]*?)\);?/gm, '$1$2')
    .replace(/test\(\s*\([^=()]*\)\s*=>\s*\{/, '')
    .replace(/\}\)\s*;$/, '');

  somedom.mount(parentNode, ['details', null, [
    ['summary', null, ['View executed code']],
    ['pre', { class: 'highlight' }, format(code)],
  ]]);
}

function appendChild(currentScript, newNode) {
  const { loaded, parentNode } = currentScript;

  if (!loaded) {
    summarize(currentScript);

    currentScript.loaded = true;
  }

  if (newNode) {
    parentNode.insertBefore(newNode, currentScript);
  }

  return newNode;
}

const tests = [];

window.test = cb => {
  tests.push({
    cb,
    el: document.currentScript,
  });
};

window.addEventListener('DOMContentLoaded', () => {
  tests.forEach(t => {
    try {
      t.cb(somedom, x => appendChild(t.el, x));
    } catch (e) {
      console.log(e);
      appendChild(t.el, somedom.render(['div', { class: 'error' }, e.toString()]));
    }
  });

  window.hijs = '.highlight';

  somedom.mount('head', ['script', {
    src: '//cdn.rawgit.com/cloudhead/hijs/0eaa0031/hijs.js',
  }]);
});
