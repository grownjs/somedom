import { test } from '@japa/runner';

import {
  signal, computed, batch,
} from '../../src/lib/signals.js';
import {
  createElement, mountElement, destroyElement,
} from '../../src/lib/node.js';

import doc from './fixtures/env.js';

const render = createElement;
const mount = mountElement;
const unmount = destroyElement;

test.group('signal DOM binding', t => {
  t.each.teardown(doc.disable);
  t.each.setup(doc.enable);

  test('should bind signal to textContent', async ({ expect }) => {
    if (typeof document === 'undefined') {
      return expect(true).toBe(true);
    }

    const count = signal(0);

    const vnode = ['div', { 'signal:textContent': count }];
    const el = render(vnode);
    mount(document.body, el);

    expect(el.textContent).toBe('0');

    count.value = 5;
    expect(el.textContent).toBe('5');

    count.value = 42;
    expect(el.textContent).toBe('42');

    unmount(el);
  });

  test('should bind computed to textContent', async ({ expect }) => {
    if (typeof document === 'undefined') {
      return expect(true).toBe(true);
    }

    const a = signal(2);
    const b = signal(3);
    const sum = computed(() => a.value + b.value);

    const vnode = ['div', { 'signal:textContent': sum }];
    const el = render(vnode);
    mount(document.body, el);

    expect(el.textContent).toBe('5');

    a.value = 10;
    expect(el.textContent).toBe('13');

    b.value = 7;
    expect(el.textContent).toBe('17');

    unmount(el);
  });

  test('should bind signal to value property', async ({ expect }) => {
    if (typeof document === 'undefined') {
      return expect(true).toBe(true);
    }

    const name = signal('John');

    const vnode = ['input', { type: 'text', 'signal:value': name }];
    const el = render(vnode);
    mount(document.body, el);

    expect(el.value).toBe('John');

    name.value = 'Jane';
    expect(el.value).toBe('Jane');

    unmount(el);
  });

  test('should bind signal to disabled property', async ({ expect }) => {
    if (typeof document === 'undefined') {
      return expect(true).toBe(true);
    }

    const isDisabled = signal(true);

    const vnode = ['button', { 'signal:disabled': isDisabled }, 'Click me'];
    const el = render(vnode);
    mount(document.body, el);

    expect(el.disabled).toBe(true);

    isDisabled.value = false;
    expect(el.disabled).toBe(false);

    unmount(el);
  });

  test('should bind signal to innerHTML', async ({ expect }) => {
    if (typeof document === 'undefined') {
      return expect(true).toBe(true);
    }

    const content = signal('<strong>Hello</strong>');

    const vnode = ['div', { 'signal:innerHTML': content }];
    const el = render(vnode);
    mount(document.body, el);

    expect(el.innerHTML).toBe('<strong>Hello</strong>');

    content.value = '<em>World</em>';
    expect(el.innerHTML).toBe('<em>World</em>');

    unmount(el);
  });

  test('should batch multiple signal updates', async ({ expect }) => {
    if (typeof document === 'undefined') {
      return expect(true).toBe(true);
    }

    const a = signal(1);
    const b = signal(2);

    const vnode = ['div', { 'signal:textContent': computed(() => a.value + b.value) }];
    const el = render(vnode);
    mount(document.body, el);

    expect(el.textContent).toBe('3');

    batch(() => {
      a.value = 10;
      b.value = 20;
    });

    expect(el.textContent).toBe('30');

    unmount(el);
  });

  test('should cleanup signal effect on unmount', async ({ expect }) => {
    if (typeof document === 'undefined') {
      return expect(true).toBe(true);
    }

    const count = signal(0);

    const vnode = ['div', { 'signal:textContent': count }];
    const el = render(vnode);
    mount(document.body, el);

    expect(el.textContent).toBe('0');

    await unmount(el);

    count.value = 100;
    expect(el.textContent).toBe('0');
  });

  test('should handle multiple signal props on same element', async ({ expect }) => {
    if (typeof document === 'undefined') {
      return expect(true).toBe(true);
    }

    const text = signal('Hello');
    const color = signal('red');

    const vnode = ['span', {
      'signal:textContent': text,
      'signal:style.color': color,
    }];
    const el = render(vnode);
    mount(document.body, el);

    expect(el.textContent).toBe('Hello');
    expect(el.style.color).toBe('red');

    text.value = 'World';
    expect(el.textContent).toBe('World');

    color.value = 'blue';
    expect(el.style.color).toBe('blue');

    unmount(el);
  });

  test('should handle signal as child', async ({ expect }) => {
    if (typeof document === 'undefined') {
      return expect(true).toBe(true);
    }

    const name = signal('World');

    const vnode = ['div', {}, 'Hello ', name, '!'];
    const el = render(vnode);
    mount(document.body, el);

    expect(el.textContent).toBe('Hello World!');

    name.value = 'John';
    expect(el.textContent).toBe('Hello John!');

    unmount(el);
  });

  test('should handle signal in attribute value', async ({ expect }) => {
    if (!doc.hasDOM()) {
      return expect(true).toBe(true);
    }

    const title = signal('Initial');

    const vnode = ['div', { title }, 'Hover me'];
    const el = render(vnode);
    mount(document.body, el);

    expect(el.getAttribute('title')).toBe('Initial');

    title.value = 'Changed';
    expect(el.getAttribute('title')).toBe('Changed');

    unmount(el);
  });

  test('should handle computed in attribute value', async ({ expect }) => {
    if (!doc.hasDOM()) {
      return expect(true).toBe(true);
    }

    const first = signal('Hello');
    const last = signal('World');
    const fullName = computed(() => `${first.value} ${last.value}`);

    const vnode = ['div', { title: fullName }, 'Hover me'];
    const el = render(vnode);
    mount(document.body, el);

    expect(el.getAttribute('title')).toBe('Hello World');

    first.value = 'Hi';
    expect(el.getAttribute('title')).toBe('Hi World');

    unmount(el);
  });
});
