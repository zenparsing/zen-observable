const Observable = require('../src/Observable');
const assert = require('assert');
const { testMethodProperty } = require('./properties');

describe('observer.error', () => {

  function getObserver(inner) {
    let observer;
    new Observable(x => { observer = x }).subscribe(inner);
    return observer;
  }

  it('is a method of SubscriptionObserver', () => {
    let observer = getObserver();
    testMethodProperty(Object.getPrototypeOf(observer), 'error', {
      configurable: true,
      writable: true,
      length: 1,
    });
  });

  it('forwards the argument', () => {
    let args;
    let observer = getObserver({ error(...a) { args = a } });
    observer.error(1);
    assert.deepEqual(args, [1]);
  });

  it('does not return a value', () => {
    let observer = getObserver({ error() { return 1 } });
    assert.equal(observer.error(), undefined);
  });

  it('throws when the subscription is complete', () => {
    let observer = getObserver({ error() {} });
    observer.complete();
    assert.throws(() => observer.error(1));
  });

  it('throws when the subscription is cancelled', () => {
    let observer;
    let subscription = new Observable(x => { observer = x }).subscribe({
      error() {},
    });
    subscription.unsubscribe();
    assert.throws(() => observer.error(1));
  });

  it('throws if the subscription is not initialized', async () => {
    let error;
    new Observable(x => { x.error() }).subscribe({
      error(err) { error = err },
    });
    await null;
    assert.ok(error instanceof Error);
  });

  it('throws if the observer is running', () => {
    let observer;
    new Observable(x => { observer = x }).subscribe({
      next() { observer.error() },
      error() {},
    });
    assert.throws(() => observer.next());
  });

  it('closes the subscription before invoking inner observer', () => {
    let closed;
    let observer = getObserver({
      error() { closed = observer.closed },
    });
    observer.error(1);
    assert.equal(closed, true);
  });

  it('throws if "error" is not a method', () => {
    let observer = getObserver({ error: 1 });
    assert.throws(() => observer.error(1));
  });

  it('throws if "error" is undefined', () => {
    let error = {};
    let observer = getObserver({ error: undefined });
    try {
      observer.error(error);
      assert.ok(false);
    } catch (e) {
      assert.equal(e, error);
    }
  });

  it('throws if "error" is null', () => {
    let error = {};
    let observer = getObserver({ error: null });
    try {
      observer.error(error);
      assert.ok(false);
    } catch (e) {
      assert.equal(e, error);
    }
  });

  it('throws if "error" throws', () => {
    let error = {};
    let observer = getObserver({ error() { throw error } });
    try {
      observer.error(1);
      assert.ok(false);
    } catch (err) {
      assert.equal(err, error);
    }
  });

  it('calls the cleanup method after "error"', () => {
    let calls = [];
    new Observable(x => {
      observer = x;
      return () => { calls.push('cleanup') };
    }).subscribe({
      error() { calls.push('error') },
    });
    observer.error();
    assert.deepEqual(calls, ['error', 'cleanup']);
  });

  it('calls the cleanup method if there is no "error"', () => {
    let calls = [];
    new Observable(x => {
      observer = x;
      return () => { calls.push('cleanup') };
    }).subscribe({});
    try {
      observer.error();
    } catch (err) {}
    assert.deepEqual(calls, ['cleanup']);
  });

  it('throws if the cleanup function throws', () => {
    let error = {};
    let observer;
    new Observable(x => {
      observer = x;
      return () => { throw error };
    }).subscribe({
      error() {},
    });
    try {
      observer.error(1);
      assert.ok(false);
    } catch (err) {
      assert.equal(err, error);
    }
  });

  it('throws the error from the observer if both throw', () => {
    let observerError = {};
    let observer;
    new Observable(x => {
      observer = x;
      return () => { throw {} };
    }).subscribe({
      error() { throw observerError },
    });
    try {
      observer.error(1);
      assert.ok(false);
    } catch (err) {
      assert.equal(err, observerError);
    }
  });
});
