import { test } from '@japa/runner';

import { signal, computed } from '../../src/lib/signals.js';
import { createElement, mountElement, destroyElement } from '../../src/lib/node.js';
import { text } from '../../src/index.js';

import doc from './fixtures/env.js';

const render = createElement;
const mount = mountElement;
const unmount = destroyElement;

test.group('text tag function', t => {
  t.each.teardown(doc.disable);
  t.each.setup(doc.enable);

  test('should return plain string when no signals', async ({ expect }) => {
    const result = text`Hello World`;
    expect(result).toBe('Hello World');
  });

  test('should return computed when signals present', async ({ expect }) => {
    const name = signal('World');
    const result = text`Hello ${name}`;

    expect(typeof result).toBe('object');
    expect('value' in result).toBe(true);
    expect(result.value).toBe('Hello World');
  });

  test('should update computed when signal changes', async ({ expect }) => {
    if (typeof document === 'undefined') {
      return expect(true).toBe(true);
    }

    const name = signal('World');
    const result = text`Hello ${name}!`;

    const vnode = ['div', {}, result];
    const el = render(vnode);
    mount(document.body, el);

    expect(el.textContent).toBe('Hello World!');

    name.value = 'John';
    expect(el.textContent).toBe('Hello John!');

    unmount(el);
  });

  test('should handle multiple signals', async ({ expect }) => {
    if (typeof document === 'undefined') {
      return expect(true).toBe(true);
    }

    const first = signal('Hello');
    const last = signal('World');
    const result = text`${first} ${last}!`;

    const vnode = ['div', {}, result];
    const el = render(vnode);
    mount(document.body, el);

    expect(el.textContent).toBe('Hello World!');

    first.value = 'Hi';
    expect(el.textContent).toBe('Hi World!');

    last.value = 'There';
    expect(el.textContent).toBe('Hi There!');

    unmount(el);
  });

  test('should handle computed in text', async ({ expect }) => {
    if (typeof document === 'undefined') {
      return expect(true).toBe(true);
    }

    const count = signal(5);
    const doubled = computed(() => count.value * 2);
    const result = text`Count: ${doubled}`;

    const vnode = ['div', {}, result];
    const el = render(vnode);
    mount(document.body, el);

    expect(el.textContent).toBe('Count: 10');

    count.value = 10;
    expect(el.textContent).toBe('Count: 20');

    unmount(el);
  });

  test('should handle nested computed', async ({ expect }) => {
    if (typeof document === 'undefined') {
      return expect(true).toBe(true);
    }

    const a = signal(1);
    const b = signal(2);
    const sum = computed(() => a.value + b.value);
    const product = computed(() => sum.value * 10);
    const result = text`Result: ${product}`;

    const vnode = ['div', {}, result];
    const el = render(vnode);
    mount(document.body, el);

    expect(el.textContent).toBe('Result: 30');

    a.value = 5;
    expect(el.textContent).toBe('Result: 70');

    b.value = 3;
    expect(el.textContent).toBe('Result: 80');

    unmount(el);
  });

  test('should handle mixed values and signals', async ({ expect }) => {
    if (typeof document === 'undefined') {
      return expect(true).toBe(true);
    }

    const name = signal('World');
    const count = signal(5);
    const result = text`Hello ${name}, you have ${count} messages`;

    const vnode = ['div', {}, result];
    const el = render(vnode);
    mount(document.body, el);

    expect(el.textContent).toBe('Hello World, you have 5 messages');

    name.value = 'John';
    expect(el.textContent).toBe('Hello John, you have 5 messages');

    count.value = 10;
    expect(el.textContent).toBe('Hello John, you have 10 messages');

    unmount(el);
  });
});
