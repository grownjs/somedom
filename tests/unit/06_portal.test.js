import { test } from '@japa/runner';

import { createElement, mountElement } from '../../src/lib/node.js';
import { portal } from '../../src/index.js';
import Portal from '../../src/lib/portal.js';
import doc from './fixtures/env.js';

test.group('Portal', t => {
  t.each.teardown(doc.disable);
  t.each.setup(doc.enable);

  test('should create Portal from vnode', ({ expect }) => {
    const modalRoot = document.createElement('div');
    modalRoot.id = 'modal-root';
    document.body.appendChild(modalRoot);

    const p = createElement(['portal', { target: modalRoot }, ['div', {}, 'Modal content']]);

    expect(Portal.valid(p)).toBe(true);
    expect(p.target).toBe(modalRoot);
    expect(p.childNodes.length).toBe(1);
  });

  test('should accept DOM element as target', ({ expect }) => {
    const target = document.createElement('div');
    const p = createElement(['portal', { target }, 'Hello']);

    expect(p.target).toBe(target);
  });

  test('should mount children to target', ({ expect }) => {
    const target = document.createElement('div');
    document.body.appendChild(target);

    const p = Portal.from(v => createElement(v), [['span', {}, 'Hello']], target);
    p.mount();

    expect(target.innerHTML).toBe('<span>Hello</span>');
  });

  test('should mount through insertElement', ({ expect }) => {
    const target = document.createElement('div');
    document.body.appendChild(target);

    const container = document.createElement('div');
    mountElement(container, ['portal', { target }, ['b', {}, 'Bold']]);

    expect(target.innerHTML).toBe('<b>Bold</b>');
    expect(container.innerHTML).toBe('');
  });

  test('should unmount children from target', ({ expect }) => {
    const target = document.createElement('div');
    document.body.appendChild(target);

    const p = Portal.from(v => createElement(v), [['span', {}, 'Test']], target);
    p.mount();

    expect(target.innerHTML).toBe('<span>Test</span>');

    p.unmount();
    expect(target.innerHTML).toBe('');
  });

  test('should handle multiple children', ({ expect }) => {
    const target = document.createElement('div');
    document.body.appendChild(target);

    const p = Portal.from(
      v => createElement(v),
      [['span', {}, 'One'], ['span', {}, 'Two']],
      target,
    );
    p.mount();

    expect(target.innerHTML).toBe('<span>One</span><span>Two</span>');
  });
});

test.group('portal helper', t => {
  t.each.teardown(doc.disable);
  t.each.setup(doc.enable);

  test('should create portal vnode', ({ expect }) => {
    const vnode = portal('#modals', ['div', {}, 'Modal']);

    expect(vnode[0]).toBe('portal');
    expect(vnode[1].target).toBe('#modals');
    expect(vnode[2]).toEqual([['div', {}, 'Modal']]);
  });

  test('should create portal vnode with multiple children', ({ expect }) => {
    const vnode = portal('#target', ['span', {}, 'A'], ['span', {}, 'B']);

    expect(vnode[2]).toEqual([['span', {}, 'A'], ['span', {}, 'B']]);
  });
});
