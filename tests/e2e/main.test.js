import somedom, { mount, render } from '../../src';
import { trim as format } from '../../src/lib/util';

function summarize(script) {
  const { innerHTML, parentNode } = script;

  const code = innerHTML
    .replace(/( +)appendChild\(([^;]*?)\);?/gm, '$1$2')
    .replace(/test\(\s*\([^=()]*\)\s*=>\s*\{/, '')
    .replace(/\}\)\s*;$/, '');

  mount(parentNode, ['details', [
    ['summary', 'View executed code'],
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
      appendChild(t.el, render(['div.error', e.toString()]));
    }
  });

  window.hijs = '.highlight';

  mount('head', ['script', { src: '//cdn.rawgit.com/cloudhead/hijs/0eaa0031/hijs.js' }]);
});
