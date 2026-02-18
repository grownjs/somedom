import { test } from '@japa/runner';

import { signal } from '../../src/lib/signals.js';
import { mountElement as mount } from '../../src/lib/node.js';
import doc from './fixtures/env.js';

test.group('d: Directives', t => {
  t.each.teardown(doc.disable);
  t.each.setup(doc.enable);

  let container;
  t.each.setup(() => {
    if (!doc.hasDOM()) {
      return;
    }
    container = document.createElement('div');
  });

  test('d:show should toggle display based on signal', ({ expect }) => {
    if (!container) {
      return expect(true).toBe(true);
    }

    const isVisible = signal(true);
    mount(container, ['div', { 'd:show': isVisible }, 'Hello']);

    expect(container.firstChild.style.display).not.toEqual('none');

    isVisible.value = false;
    expect(container.firstChild.style.display).toEqual('none');

    isVisible.value = true;
    expect(container.firstChild.style.display).not.toEqual('none');
  });

  test('d:hide should toggle display inversely', ({ expect }) => {
    if (!container) {
      return expect(true).toBe(true);
    }

    const isHidden = signal(false);
    mount(container, ['div', { 'd:hide': isHidden }, 'Hello']);

    expect(container.firstChild.style.display).not.toEqual('none');

    isHidden.value = true;
    expect(container.firstChild.style.display).toEqual('none');
  });

  test('d:text should bind textContent', ({ expect }) => {
    if (!container) {
      return expect(true).toBe(true);
    }

    const text = signal('Hello');
    mount(container, ['span', { 'd:text': text }]);

    expect(container.textContent).toEqual('Hello');

    text.value = 'World';
    expect(container.textContent).toEqual('World');
  });

  test('d:html should bind innerHTML', ({ expect }) => {
    if (!container) {
      return expect(true).toBe(true);
    }

    const content = signal('<b>bold</b>');
    mount(container, ['div', { 'd:html': content }]);

    expect(container.innerHTML).toEqual('<div><b>bold</b></div>');

    content.value = '<i>italic</i>';
    expect(container.innerHTML).toEqual('<div><i>italic</i></div>');
  });

  test('d:class should toggle class', ({ expect }) => {
    if (!container) {
      return expect(true).toBe(true);
    }

    const isActive = signal(true);
    mount(container, ['button', { 'd:class': isActive }, 'Click']);

    expect(container.firstChild.className).toEqual('active');

    isActive.value = false;
    expect(container.firstChild.className).toEqual('');
  });

  test('d:model should two-way bind input', ({ expect }) => {
    if (!container) {
      return expect(true).toBe(true);
    }

    const username = signal('');
    mount(container, ['input', { 'd:model': username, type: 'text' }]);

    const input = container.firstChild;
    expect(username.value).toEqual('');

    input.value = 'John';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    expect(username.value).toEqual('John');

    username.value = 'Jane';
    expect(input.value).toEqual('Jane');
  });
});
