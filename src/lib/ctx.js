const STACK = [];

export function pop(scope) {
  STACK.splice(STACK.indexOf(scope), 1);
}

export function push(scope) {
  STACK.push(scope);
}

export function getContext() {
  return STACK[STACK.length - 1];
}
