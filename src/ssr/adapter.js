function isTag(node) {
  return node && node.nodeType === 1;
}

function getAttributeValue(elem, name) {
  return this.isTag(elem) ? elem.getAttribute(name) : undefined;
}

function getName(elem) {
  return elem.tagName ? elem.tagName.toLowerCase() : null;
}

function getChildren(node) {
  return node && node.childNodes;
}

function getParent(node) {
  return node ? node.parentNode : null;
}

function getText(node) {
  return node.textContent;
}

function removeSubsets(nodes) {
  let idx = nodes.length;
  let node;
  let ancestor;
  let replace;
  while (--idx > -1) {
    node = ancestor = nodes[idx];
    nodes[idx] = null;
    replace = true;
    while (ancestor) {
      if (!nodes.includes(ancestor)) {
        replace = false;
        nodes.splice(idx, 1);
        break;
      }
      ancestor = this.getParent(ancestor);
    }
    if (replace) nodes[idx] = node;
  }
  return nodes;
}

function existsOne(test, elems) {
  return elems.some(elem => (this.isTag(elem)
    ? test(elem) || this.existsOne(test, this.getChildren(elem))
    : false));
}

function getSiblings(node) {
  const parent = this.getParent(node);
  return parent ? this.getChildren(parent) : [];
}

function hasAttrib(elem, name) {
  return this.getAttributeValue(elem, name) !== undefined;
}

function findOne(test, elems) {
  let elem = null;
  for (let i = 0, l = elems.length; i < l && !elem; i++) {
    const el = elems[i];

    if (test(el)) {
      elem = el;
    } else {
      const childs = this.getChildren(el);

      if (childs && childs.length > 0) elem = this.findOne(test, childs);
    }
  }
  return elem;
}

function findAll(test, nodes) {
  let result = [];
  for (let i = 0, j = nodes.length; i < j; i++) {
    // eslint-disable-next-line no-continue
    if (!this.isTag(nodes[i])) continue;
    if (test(nodes[i])) result.push(nodes[i]);

    const childs = this.getChildren(nodes[i]);

    if (childs) result = result.concat(this.findAll(test, childs));
  }
  return result;
}

export const markupAdapter = {
  isTag, getAttributeValue, getName, getChildren, getParent, getText, removeSubsets, existsOne, getSiblings, hasAttrib, findOne, findAll,
};
