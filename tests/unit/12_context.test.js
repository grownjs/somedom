import { test } from '@japa/runner';

import { effect, trap } from '../../src/lib/signals.js';
import { scope } from '../../src/lib/context.js';

test.group('scope', () => {
  test('should create a scope with initial value', ({ expect }) => {
    const Theme = scope('light');
    expect(Theme.value).toBe('light');
  });

  test('should update value', ({ expect }) => {
    const Theme = scope('light');
    Theme.value = 'dark';
    expect(Theme.value).toBe('dark');
  });

  test('should peek value without subscribing', ({ expect }) => {
    const Theme = scope('light');
    expect(Theme.peek()).toBe('light');
  });

  test('should notify subscribers on change', ({ expect }) => {
    const Theme = scope('light');
    let calls = 0;

    effect(() => {
      // eslint-disable-next-line no-unused-expressions
      Theme.value;
      calls++;
    });

    expect(calls).toBe(1);
    Theme.value = 'dark';
    expect(calls).toBe(2);
  });

  test('should not notify if value is same', ({ expect }) => {
    const Theme = scope('light');
    let calls = 0;

    effect(() => {
      // eslint-disable-next-line no-unused-expressions
      Theme.value;
      calls++;
    });

    expect(calls).toBe(1);
    Theme.value = 'light';
    expect(calls).toBe(1);
  });

  test('should allow manual subscription', ({ expect }) => {
    const Theme = scope('light');
    let notified = false;

    const unsub = Theme.subscribe(() => {
      notified = true;
    });

    Theme.value = 'dark';
    expect(notified).toBe(true);

    unsub();
  });

  test('should provide temporary value', ({ expect }) => {
    const Theme = scope('light');

    const result = Theme.provide('dark', () => {
      expect(Theme.value).toBe('dark');
      return 'done';
    });

    expect(result).toBe('done');
    expect(Theme.value).toBe('light');
  });

  test('should restore value after provide even on error', ({ expect }) => {
    const Theme = scope('light');

    try {
      Theme.provide('dark', () => {
        throw new Error('test');
      });
    } catch (e) {
      // ignore
    }

    expect(Theme.value).toBe('light');
  });
});

test.group('trap', () => {
  test('should catch errors in effects', ({ expect }) => {
    const errors = [];
    const dispose = trap(e => {
      errors.push(e.message);
    });

    effect(() => {
      throw new Error('oops');
    });

    expect(errors).toContain('oops');
    dispose();
  });

  test('should allow trap to return cleanup', ({ expect }) => {
    let cleaned = false;
    const dispose = trap(() => {
      cleaned = true;
    });

    effect(() => {
      throw new Error('oops');
    });

    expect(cleaned).toBe(true);
    dispose();
  });

  test('should restore previous trap on dispose', ({ expect }) => {
    const outerErrors = [];
    const innerErrors = [];

    const outer = trap(e => {
      outerErrors.push(e.message);
    });

    const inner = trap(e => {
      innerErrors.push(e.message);
    });

    effect(() => {
      throw new Error('inner error');
    });

    expect(innerErrors).toContain('inner error');
    expect(outerErrors).toHaveLength(0);

    inner();

    effect(() => {
      throw new Error('outer error');
    });

    expect(outerErrors).toContain('outer error');
    outer();
  });

  test('should throw if no trap handler', ({ expect }) => {
    expect(() => {
      effect(() => {
        throw new Error('unhandled');
      });
    }).toThrow('unhandled');
  });
});

test.group('scope and trap integration', () => {
  test('should work together', ({ expect }) => {
    const Theme = scope('light');
    const errors = [];

    trap(e => {
      errors.push(e.message);
    });

    effect(() => {
      if (Theme.value === 'error') {
        throw new Error('invalid theme');
      }
    });

    expect(errors).toHaveLength(0);
    Theme.value = 'error';
    expect(errors).toContain('invalid theme');
  });
});
