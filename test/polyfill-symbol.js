import assert from 'assert';
import { polyfillSymbol } from '../src/Observable.js';

describe('symbol polyfilling', () => {
  it('extends the provided object', () => {
    const returnValue = {};
    const fakeSymbol = () => returnValue;

    polyfillSymbol(fakeSymbol);

    const desc = Object.getOwnPropertyDescriptor(fakeSymbol, 'observable');
    assert(!!desc, 'property descriptor present');
    assert.equal(desc.writable, true, 'writable');
    assert.equal(desc.enumerable, true, 'enumerable');
    assert.equal(desc.configurable, true, 'configurable');
    assert.equal(desc.value, returnValue);
  });

  it('constructs the expected value', () => {
    const observed = {
      callCount: 0
    };
    const fakeSymbol = function(...args) {
      observed.callCount += 1;
      observed.newTarget = new.target;
      observed.thisValue = this;
      observed.args = args;
    };

    polyfillSymbol(fakeSymbol);

    assert.equal(observed.callCount, 1, 'call count');
    assert.equal(observed.newTarget, undefined, 'new.target');
    assert.equal(observed.thisValue, undefined, '"this" value');
    assert.deepEqual(observed.args, ['observable'], 'arguments');
  });

  it('tolerates non-extensible objects (in support of immutable realms)', () => {
    const fakeSymbol = () => {};
    Object.freeze(fakeSymbol);

    polyfillSymbol(fakeSymbol);
  });
});
