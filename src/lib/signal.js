import { effect } from './signals.js';

export function Signal({ value }, ...children) {
  let renderFn;
  
  if (children.length > 0 && typeof children[0] === 'function') {
    renderFn = children[0];
  }
  
  const element = {
    nodeType: 1,
    nodeName: 'SIGNAL',
    tagName: 'SIGNAL',
    parentNode: null,
    parentElement: null,
    firstChild: null,
    childNodes: [],
    removeChild() {},
    appendChild() {},
    insertBefore() {},
    replaceChild() {},
    setAttribute() {},
    removeAttribute() {},
    addEventListener() {},
    removeEventListener() {},
    getAttribute() { return null; },
    hasAttribute() { return false; },
    classList: {
      add() {},
      remove() {},
      toggle() {},
      contains() { return false; },
    },
    style: {},
    ownerDocument: document,
    teardown: null,
  };

  if (value && typeof value === 'object' && 'value' in value) {
    let currentNode = null;
    
    const dispose = effect(() => {
      const newValue = value.value;
      let content;
      
      if (renderFn) {
        content = renderFn(newValue);
      } else {
        content = newValue;
      }
      
      const textNode = document.createTextNode(String(content != null ? content : ''));
      
      if (currentNode && currentNode.parentNode) {
        currentNode.parentNode.replaceChild(textNode, currentNode);
      }
      currentNode = textNode;
      
      element.firstChild = textNode;
      element.childNodes = [textNode];
    });
    
    element.teardown = () => {
      dispose();
    };
  }

  return element;
}
