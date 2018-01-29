const Observable = require('../src/Observable');
const assert = require('assert');

describe('from', () => {
  const iterable = {
    *[Symbol.iterator]() {
      yield 1;
      yield 2;
      yield 3;
    },
  };

  it('throws if the argument is null', () => {
    assert.throws(() => Observable.from(null));
  });

  it('throws if the argument is undefined', () => {
    assert.throws(() => Observable.from(undefined));
  });

  it('returns the input if the constructor matches "this"', () => {
    let ctor = function() {};
    let observable = new Observable(() => {});
    observable.constructor = ctor;
    assert.equal(Observable.from.call(ctor, observable), observable);
  });

  it('throws if "subscribe" is not a method', () => {
    assert.throws(() => Observable.from({ subscribe: 1 }));
  });

  it('returns an observable wrapping "subscribe"', () => {
    let observer;
    let cleanupCalled = true;
    let observable = Observable.from({
      subscribe(x) {
        observer = x;
        return () => { cleanupCalled = true };
      },
    });
    observable.subscribe();
    assert.equal(typeof observer.next, 'function');
    observer.complete();
    assert.equal(cleanupCalled, true);
  });

  it('throws if Symbol.iterator is not a method', () => {
    assert.throws(() => Observable.from({ [Symbol.iterator]: 1 }));
  });

  it('returns an observable wrapping iterables', async () => {
    let calls = [];
    let subscription = Observable.from(iterable).subscribe({
      next(v) { calls.push(['next', v]) },
      complete() { calls.push(['complete']) },
    });
    assert.deepEqual(calls, []);
    await null;
    assert.deepEqual(calls, [
      ['next', 1],
      ['next', 2],
      ['next', 3],
      ['complete'],
    ]);
  });

  it('throws if the argument is not observable or iterable', () => {
    assert.throws(() => Observable.from({}));
  });
});
