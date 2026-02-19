import { test } from '@japa/runner';

import {
  signal, computed, effect, batch, untracked,
} from '../../src/lib/signals.js';

test.group('signal', () => {
  test('should create a signal with initial value', ({ expect }) => {
    const count = signal(0);
    expect(count.value).toBe(0);
  });

  test('should update value', ({ expect }) => {
    const count = signal(0);
    count.value = 5;
    expect(count.value).toBe(5);
  });

  test('should peek value without subscribing', ({ expect }) => {
    const count = signal(42);
    expect(count.peek()).toBe(42);
  });

  test('should notify subscribers on change', ({ expect }) => {
    const count = signal(0);
    let calls = 0;

    effect(() => {
      // eslint-disable-next-line no-unused-expressions
      count.value;
      calls++;
    });

    expect(calls).toBe(1);
    count.value = 1;
    expect(calls).toBe(2);
  });

  test('should not notify if value is same', ({ expect }) => {
    const count = signal(0);
    let calls = 0;

    effect(() => {
      // eslint-disable-next-line no-unused-expressions
      count.value;
      calls++;
    });

    expect(calls).toBe(1);
    count.value = 0;
    expect(calls).toBe(1);
  });

  test('should allow manual subscription', ({ expect }) => {
    const count = signal(0);
    let notified = false;

    const unsub = count.subscribe(() => {
      notified = true;
    });

    count.value = 5;
    expect(notified).toBe(true);
    expect(count.value).toBe(5);

    unsub();
  });

  test('should support onSubscribe/onUnsubscribe options', ({ expect }) => {
    let subCount = 0;
    let unsubCount = 0;

    const count = signal(0, {
      onSubscribe: () => subCount++,
      onUnsubscribe: () => unsubCount++,
    });

    const dispose = effect(() => count.value);

    expect(subCount).toBe(1);

    dispose();

    expect(unsubCount).toBe(1);
  });
});

test.group('computed', () => {
  test('should compute derived value', ({ expect }) => {
    const a = signal(2);
    const b = signal(3);
    const sum = computed(() => a.value + b.value);

    expect(sum.value).toBe(5);
  });

  test('should update when dependencies change', ({ expect }) => {
    const count = signal(1);
    const doubled = computed(() => count.value * 2);

    expect(doubled.value).toBe(2);
    count.value = 5;
    expect(doubled.value).toBe(10);
  });

  test('should peek without re-subscribing', ({ expect }) => {
    const count = signal(5);
    const doubled = computed(() => count.value * 2);

    expect(doubled.peek()).toBe(10);
  });

  test('should chain computed values', ({ expect }) => {
    const count = signal(1);
    const doubled = computed(() => count.value * 2);
    const quadrupled = computed(() => doubled.value * 2);

    expect(quadrupled.value).toBe(4);
    count.value = 3;
    expect(quadrupled.value).toBe(12);
  });

  test('should only recompute when accessed', ({ expect }) => {
    const count = signal(1);
    let computeCount = 0;

    const doubled = computed(() => {
      computeCount++;
      return count.value * 2;
    });

    expect(doubled.value).toBe(2);
    expect(computeCount).toBe(1);

    count.value = 5;

    expect(computeCount).toBe(1);

    expect(doubled.value).toBe(10);
    expect(computeCount).toBe(2);
  });
});

test.group('effect', () => {
  test('should run effect on creation', ({ expect }) => {
    const count = signal(0);
    let calls = 0;

    effect(() => {
      // eslint-disable-next-line no-unused-expressions
      count.value;
      calls++;
    });

    expect(calls).toBe(1);
  });

  test('should re-run when signal changes', ({ expect }) => {
    const count = signal(0);
    let lastValue = null;

    effect(() => {
      lastValue = count.value;
    });

    expect(lastValue).toBe(0);
    count.value = 42;
    expect(lastValue).toBe(42);
  });

  test('should return dispose function', ({ expect }) => {
    const count = signal(0);
    let calls = 0;

    const dispose = effect(() => {
      // eslint-disable-next-line no-unused-expressions
      count.value;
      calls++;
    });

    expect(calls).toBe(1);
    dispose();
    count.value = 100;
    expect(calls).toBe(1);
  });

  test('should handle cleanup function', ({ expect }) => {
    const count = signal(0);
    let cleanups = 0;

    effect(() => {
      // eslint-disable-next-line no-unused-expressions, no-void
      void count.value;
      return () => {
        cleanups++;
      };
    });

    expect(cleanups).toBe(0);
    count.value = 1;
    expect(cleanups).toBe(1);
  });

  test('should run cleanup on dispose', ({ expect }) => {
    let cleanups = 0;

    const dispose = effect(() => {
      return () => {
        cleanups++;
      };
    });

    expect(cleanups).toBe(0);
    dispose();
    expect(cleanups).toBe(1);
  });

  test('should track computed dependencies', ({ expect }) => {
    const count = signal(1);
    const doubled = computed(() => count.value * 2);
    let lastValue = null;

    effect(() => {
      lastValue = doubled.value;
    });

    expect(lastValue).toBe(2);
    count.value = 5;
    expect(lastValue).toBe(10);
  });
});

test.group('batch', () => {
  test('should batch multiple updates', ({ expect }) => {
    const a = signal(1);
    const b = signal(2);
    let calls = 0;

    effect(() => {
      // eslint-disable-next-line no-unused-expressions, no-void
      void a.value;
      // eslint-disable-next-line no-unused-expressions, no-void
      void b.value;
      calls++;
    });

    expect(calls).toBe(1);

    batch(() => {
      a.value = 10;
      b.value = 20;
    });

    expect(calls).toBe(2);
    expect(a.value).toBe(10);
    expect(b.value).toBe(20);
  });

  test('should support nested batches', ({ expect }) => {
    const count = signal(0);
    let calls = 0;

    effect(() => {
      // eslint-disable-next-line no-unused-expressions
      count.value;
      calls++;
    });

    expect(calls).toBe(1);

    batch(() => {
      batch(() => {
        count.value = 1;
      });
      count.value = 2;
    });

    expect(calls).toBe(2);
  });
});

test.group('untracked', () => {
  test('should read without subscribing', ({ expect }) => {
    const count = signal(0);
    let calls = 0;

    effect(() => {
      calls++;
      untracked(() => count.value);
    });

    expect(calls).toBe(1);
    count.value = 100;
    expect(calls).toBe(1);
  });

  test('should return value from callback', ({ expect }) => {
    const count = signal(42);
    const value = untracked(() => count.value);
    expect(value).toBe(42);
  });
});

test.group('integration', () => {
  test('should work with complex dependencies', ({ expect }) => {
    const firstName = signal('John');
    const lastName = signal('Doe');
    const fullName = computed(() => `${firstName.value} ${lastName.value}`);
    const greeting = computed(() => `Hello, ${fullName.value}!`);

    let result = '';
    effect(() => {
      result = greeting.value;
    });

    expect(result).toBe('Hello, John Doe!');

    firstName.value = 'Jane';
    expect(result).toBe('Hello, Jane Doe!');

    lastName.value = 'Smith';
    expect(result).toBe('Hello, Jane Smith!');
  });

  test('should handle conditional dependencies', ({ expect }) => {
    const show = signal(true);
    const a = signal(1);
    const b = signal(2);
    let calls = 0;
    let lastValue = null;

    effect(() => {
      calls++;
      lastValue = show.value ? a.value : b.value;
    });

    expect(calls).toBe(1);
    expect(lastValue).toBe(1);

    b.value = 20;
    expect(calls).toBe(1);

    show.value = false;
    expect(calls).toBe(2);
    expect(lastValue).toBe(20);
  });
});
