/* eslint-disable no-unused-expressions */

import td from 'testdouble';
import { expect } from 'chai';

import {
  raf, clone, apply, filter, dashCase, replace, remove, append, detach,
} from '../../src/lib/util';

import {
  isNot, isArray, isFunction, isObject, isScalar, isNode, isEmpty, toArray, toProxy, isDiff,
} from '../../src/lib/shared';

import doc from './fixtures/env';

/* global beforeEach, afterEach, describe, it */

describe('util', () => {
  beforeEach(doc.enable);
  afterEach(doc.disable);

  describe('clone', () => {
    it('should copy most common values', () => {
      const a = [{ d: new Date() }, { r: /x/ }];
      const b = clone(a);

      a[0].d.setTime(0);

      expect(a).not.eql(b);
    });
  });

  describe('apply', () => {
    const opts = {};
    const cbTag = td.func('tag');
    const cbAttrs = td.func('attrs');

    const callTag = apply(cbTag, 1, opts);
    const callAttrs = apply(cbAttrs, 2, opts);

    it('should skip invalid arguments length', () => {
      callTag();
      callAttrs();

      expect(td.explain(cbTag).callCount).to.eql(0);
      expect(td.explain(cbAttrs).callCount).to.eql(0);
    });

    it('should match given arguments length exactly', () => {
      td.when(cbTag(1, opts)).thenReturn('OK');
      td.when(cbAttrs(1, 2, opts)).thenReturn('OK');

      expect(callTag(1)).to.eql('OK');
      expect(callAttrs(1, 2)).to.eql('OK');

      expect(td.explain(cbTag).callCount).to.eql(1);
      expect(td.explain(cbAttrs).callCount).to.eql(1);
    });
  });

  describe('filter', () => {
    it('should remove any falsy values', () => {
      expect(filter).to.throw();
      expect(filter([])).to.eql([]);
      expect(filter([0, 1, 2])).to.eql([0, 1, 2]);
      expect(filter([null, false, true, undefined])).to.eql([true]);
    });
  });

  describe('isNot', () => {
    it('should assert for undefined or null values', () => {
      expect(isNot).not.to.throw();
      expect(isNot()).to.be.true;
      expect(isNot(0)).to.be.false;
      expect(isNot(NaN)).to.be.false;
      expect(isNot([])).to.be.false;
      expect(isNot({})).to.be.false;
      expect(isNot(false)).to.be.false;
      expect(isNot('')).to.be.false;
      expect(isNot(Infinity)).to.be.false;
      expect(isNot(undefined)).to.be.true;
    });
  });

  describe('isArray', () => {
    it('should call Array.isArray', () => {
      expect(isArray).not.to.throw();
      expect(isArray(1)).to.be.false;
    });
  });

  describe('isFunction', () => {
    it('should validate given functions', () => {
      expect(isFunction).not.to.throw();
      expect(isFunction(1)).to.be.false;
    });
  });

  describe('isObject', () => {
    it('should validate given objects/functions', () => {
      expect(isObject).not.to.throw();
      expect(isObject(1)).to.be.false;
      expect(isObject({})).to.be.true;
      expect(isObject([])).to.be.true;
    });
  });

  describe('isScalar', () => {
    it('should validate given scalars', () => {
      expect(isScalar).not.to.throw();
      expect(isScalar(1)).to.be.true;
      expect(isScalar({})).to.be.false;
      expect(isScalar(null)).to.be.false;
    });
  });

  describe('isNode', () => {
    it('should validate given vnodes', () => {
      expect(isNode).not.to.throw();
      expect(isNode(1)).to.be.false;
      expect(isNode({})).to.be.false;
      expect(isNode([])).to.be.false;
      expect(isNode([''])).to.be.false;
      expect(isNode(['x'])).to.be.false;
      expect(isNode(['x', 'y'])).to.be.false;
      expect(isNode(['x', 'y', 'z'])).to.be.false;
      expect(isNode(['x', ['y', 'z']])).to.be.true;
      expect(isNode(['a', undefined])).to.be.false;
      expect(isNode(['a', null])).to.be.true;
      expect(isNode(['a', {}])).to.be.true;
      expect(isNode([Function])).to.be.true;
    });
  });

  describe('isEmpty', () => {
    it('should validate empty values', () => {
      expect(isEmpty).not.to.throw();
      expect(isEmpty()).to.be.true;
      expect(isEmpty(1)).to.be.false;
      expect(isEmpty(0)).to.be.false;
      expect(isEmpty('')).to.be.false;
      expect(isEmpty([])).to.be.true;
      expect(isEmpty({})).to.be.true;
      expect(isEmpty(Function)).to.be.false;
    });
  });

  describe('isDiff', () => {
    it('should compare two given values', () => {
      expect(isDiff).not.to.throw();
      expect(isDiff()).not.to.be.true;
      expect(isDiff(1, '1')).to.be.true;
      expect(isDiff(['foo'], ['foo'])).not.to.be.true;
      expect(isDiff(['foo'], ['bar'])).to.be.true;
      expect(isDiff(['foo'], ['foo', 'bar'])).to.be.true;
      expect(isDiff({ a: 'b' }, { a: 'b' })).not.to.be.true;
      expect(isDiff({ a: 'b' }, { c: 'd' })).to.be.true;
      expect(isDiff({ a: 'b' }, { a: 'B' })).to.be.true;
      expect(isDiff({ a: 'b' }, { a: 'b', c: 'd' })).to.be.true;
    });
  });

  describe('dashCase', () => {
    it('should convert fromCamelCase -> to-dash-case', () => {
      expect(dashCase).to.throw();
      expect(dashCase('aBC')).to.eql('a-b-c');
    });
  });

  describe('toArray', () => {
    it('should normalize given values as arrays', () => {
      expect(toArray).not.to.throw();
      expect(toArray([1])).to.eql([1]);
      expect(toArray(1)).to.eql([1]);
      expect(toArray(0)).to.eql([0]);
      expect(toArray(null)).to.eql([]);
      expect(toArray(false)).to.eql([]);
      expect(toArray(undefined)).to.eql([]);
    });
  });

  describe('toProxy', () => {
    it('should wrap array-props with a proxy', () => {
      const p = toProxy([]);

      p.x = 'y';
      p.a = 'b';

      expect(p).to.eql(['x', 'y', 'a', 'b']);

      expect('a' in p).to.be.true;
      delete p.a;
      delete p.undef;
      expect('a' in p).to.be.false;
    });
  });

  describe('document', () => {
    describe('raf', () => {
      it('will invoke window.requestAnimationFrame or setTimeout', async () => {
        const a = td.func('raf');
        const b = td.func('cb');

        global.window = {
          requestAnimationFrame: a,
        };

        td.when(a(b))
          .thenReturn(42);

        expect(raf(b)).to.eql(42);

        delete global.window;

        expect(td.explain(a).callCount).to.eql(1);
        expect(td.explain(b).callCount).to.eql(0);

        raf(b);

        await new Promise(ok => setTimeout(ok));

        expect(td.explain(b).callCount).to.eql(1);
      });
    });
  });

  describe('DOM', () => {
    let a;
    let b;
    let c;

    beforeEach(() => {
      a = document.createElement('a');
      b = document.createElement('b');
      c = document.createElement('c');

      a.appendChild(b);

      expect(a.outerHTML).to.eql('<a><b></b></a>');
    });

    describe('replace', () => {
      it('should replace childNodes', () => {
        replace(a, c, 0);
        expect(a.outerHTML).to.eql('<a><c></c></a>');
      });
    });

    describe('remove', () => {
      it('should remove childNodes', () => {
        remove(a, b);
        expect(a.outerHTML).to.eql('<a></a>');
      });
    });

    describe('append', () => {
      it('should append childNodes', () => {
        append(a, c);
        expect(a.outerHTML).to.eql('<a><b></b><c></c></a>');
      });
    });

    describe('detach', () => {
      it('should detach childNodes', () => {
        const x = document.createElement('x');
        detach(b, x);
        expect(a.outerHTML).to.eql('<a><x></x></a>');
      });
    });
  });
});
