const STACK = [];

export function pop(scope) {
  STACK[STACK.indexOf(scope)] = null;
}

export function push(scope) {
  STACK.push(scope);
}

export function getContext() {
  const scope = STACK[STACK.length - 1];

  if (!scope) {
    throw new Error('Cannot call getContext() outside views');
  }

  return scope;
}
