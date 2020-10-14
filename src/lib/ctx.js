const STACK = [];

export function pop(scope) {
  STACK.splice(STACK.indexOf(scope), 1);
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
