import { test } from '@japa/runner';

import {
  specify,
  style,
  rulify,
  classify,
  scopify,
  cssify,
} from '../../src/ssr/index.js';

test.group('ssr css helpers', () => {
  test('should scope selector parts with specify()', ({ expect }) => {
    expect(specify('x-42', 'button')).toEqual('button:where(.x-42)');
    expect(specify('x-42', 'button:hover')).toEqual('button:where(.x-42):hover');
    expect(specify('x-42', '[aria-live="polite"]:focus', true)).toEqual('[aria-live="polite"].x-42:focus');
  });

  test('should format rules from style/rulify/cssify()', ({ expect }) => {
    const single = {
      type: 'rule',
      selectors: ['h1'],
      declarations: [{ type: 'declaration', property: 'color', value: 'red' }],
    };

    expect(style(single)).toEqual('h1{color:red;}');

    const a = rulify('h1 { color: red; }', 'sample.css');
    const b = rulify('@media screen { h1 { color: red; } }', 'sample.css');

    expect(a).toEqual(['h1{color:red;}']);
    expect(cssify(b)).toEqual('@media screen{h1{color:red;}}');
  });

  test('should classify and scopify selectors + nodes using hooks', ({ expect }) => {
    const node = { name: 'h1', attributes: {} };
    const chunk = { selectors: ['h1:hover'] };

    classify('x-42', false, chunk, [], {
      match: () => [node],
      skipNode: n => n.name === 'script',
      appendScopeClass: (n, ref) => {
        n.attributes.class = `${n.attributes.class || ''} ${ref}`.trim();
      },
    });

    expect(chunk.selectors).toEqual(['h1:where(.x-42):hover']);
    expect(node.attributes.class).toEqual('x-42');

    const children = [{ name: 'a', attributes: {} }];
    const out = scopify('z-9', true, 'a { color: red; }', children, 'sample.css', {
      match: () => children,
      appendScopeClass: (n, ref) => {
        n.attributes.class = `${n.attributes.class || ''} ${ref}`.trim();
      },
    });

    expect(out).toEqual(['a.z-9.z-9{color:red;}']);
    expect(children[0].attributes.class).toEqual('z-9');
  });
});
