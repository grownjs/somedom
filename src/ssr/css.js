import parser from 'css';
import { selectAll } from 'css-select';

import { markupAdapter } from './adapter.js';

const SPLITTER = /[\s~+>]/;

const formatRule = chunk => parser.stringify({ stylesheet: { rules: [chunk] } }, { compress: true });

export function style(chunk) {
  return formatRule(chunk);
}

export function rulify(css, filepath) {
  const ast = parser.parse(css, { source: filepath });
  const out = [];

  ast.stylesheet.rules.forEach(chunk => {
    if (chunk.type !== 'rule') {
      if (chunk.rules) {
        const rules = [];

        chunk.rules.forEach(rule => {
          rules.push(formatRule(rule));
        });

        out.push([`@${chunk.type} ${chunk[chunk.type]}`, rules]);
      } else {
        out.push(formatRule(chunk));
      }
      return;
    }

    out.push(formatRule(chunk));
  });

  return out;
}

export function specify(ref, value, useClass) {
  if (value.includes(']')) {
    const offset = value.lastIndexOf(']');
    const prefix = value.substr(0, offset + 1);
    const suffix = value.substr(offset + 1);

    return useClass ? `${prefix}.${ref}${suffix}` : `${prefix}:where(.${ref})${suffix}`;
  }

  const offset = value.indexOf(':');
  if (offset === -1) {
    return useClass ? `${value}.${ref}` : `${value}:where(.${ref})`;
  }

  const prefix = value.substr(0, offset);
  const suffix = value.substr(offset);
  return useClass ? `${prefix}.${ref}${suffix}` : `${prefix}:where(.${ref})${suffix}`;
}

const defaultMatch = (rule, children, adapter = markupAdapter) => selectAll(rule, children, { adapter });
const defaultSkip = () => false;
const defaultAppend = (node, ref) => {
  if (node && node.classList && node.classList.add) {
    node.classList.add(ref);
    return;
  }

  if (node && node.getAttribute && node.setAttribute) {
    const names = node.getAttribute('class') || '';
    node.setAttribute('class', `${names} ${ref}`.trim());
    return;
  }

  if (node && node.attributes) {
    node.attributes.class = `${node.attributes.class || ''} ${ref}`.trim();
    return;
  }

  node.attribs = node.attribs || {};
  node.attribs.class = `${node.attribs.class || ''} ${ref}`.trim();
};

export function classify(ref, useClass, chunk, children, options = {}) {
  const rules = chunk.selectors || [];
  const parents = rules.map(x => x.split(SPLITTER)[0].split('::')[0]);
  const subnodes = rules.map(x => x.split(SPLITTER).pop().split('::')[0]);
  const selectors = [...new Set(parents.concat(subnodes))];

  const match = options.match || defaultMatch;
  const skipNode = options.skipNode || defaultSkip;
  const appendScope = options.appendScopeClass || defaultAppend;

  selectors.forEach(rule => {
    const matches = match(rule, children, options.adapter || markupAdapter);

    if (!matches) return;

    chunk.selectors = chunk.selectors.map(selector => {
      if (!selector.includes(ref) && matches.length > 0) {
        const tokens = selector.split(' ');
        const first = tokens.shift();
        const last = tokens.pop();

        [first, last].forEach((sel, i) => {
          if (!sel) return;
          sel = specify(ref, sel, useClass);
          if (i === 0) tokens.unshift(sel);
          else tokens.push(sel);
        });

        if (useClass && tokens.length === 1) {
          tokens[0] = specify(ref, tokens[0], useClass);
        }
        return tokens.join(' ');
      }
      return selector;
    });

    matches.forEach(node => {
      if (node.matches || skipNode(node)) return;
      node.matches = true;
      appendScope(node, ref);
    });
  });
}

export function scopify(ref, useClass, styles, children, filepath, options = {}) {
  const ast = parser.parse(styles.trim(), { source: filepath });
  const out = [];

  ast.stylesheet.rules.forEach(chunk => {
    if (chunk.type !== 'rule') {
      if (chunk.rules) {
        const rules = [];

        chunk.rules.forEach(rule => {
          classify(ref, useClass, rule, children, options);
          rules.push(formatRule(rule));
        });

        out.push([`@${chunk.type} ${chunk[chunk.type]}`, rules]);
      } else {
        out.push(formatRule(chunk));
      }
      return;
    }

    classify(ref, useClass, chunk, children, options);
    out.push(formatRule(chunk));
  });

  return out;
}

export function cssify(styles) {
  const out = [];

  styles.forEach(css => {
    if (Array.isArray(css)) {
      if (css[0][0] === '@') {
        if (css[1].length > 0) {
          out.push(`${css[0]}{${css[1].join('\n')}}`);
        }
      } else {
        out.push(css.join('\n'));
      }
    } else {
      out.push(css);
    }
  });

  return out.join('\n').trim();
}
