import assert from 'assert';
import { testMethodProperty } from './properties.js';

describe('observer.next', () => {

  function getObserver(inner) {
    let observer;
    new Observable(x => { observer = x }).observe(inner);
    return observer;
  }

  it('is a method of SubscriptionObserver', () => {
    let observer = getObserver();
    testMethodProperty(Object.getPrototypeOf(observer), 'next', {
      configurable: true,
      writable: true,
      length: 1,
    });
  });

  it('forwards the first argument', () => {
    let args;
    let observer = getObserver({ next(...a) { args = a } });
    observer.start();
    observer.next(1, 2);
    assert.deepEqual(args, [1]);
  });

  it('does not return a value', () => {
    let observer = getObserver({ next() { return 1 } });
    observer.start();
    assert.equal(observer.next(), undefined);
  });

  it('does not forward when the subscription is complete', () => {
    let count = 0;
    let observer = getObserver({ next() { count++ } });
    observer.start();
    observer.complete();
    observer.next();
    assert.equal(count, 0);
  });

  it('does not forward when the subscription is cancelled', () => {
    let count = 0;
    let cancel;
    let observer = getObserver({
      start(c) { cancel = c },
      next() { count++ },
    });
    observer.start();
    cancel();
    observer.next();
    assert.equal(count, 0);
  });

  it('remains closed if the subscription is cancelled from "next"', () => {
    let observer = getObserver({
      start(c) { this.cancel = c },
      next() { this.cancel() },
    });
    observer.start();
    observer.next();
    assert.equal(observer.closed, true);
  });

  it('calls start if the subscription is not initialized', () => {
    let values = [];
    let startCalled = false;
    let observer = getObserver({
      start() { startCalled = true },
      next(val) { values.push(val) },
    });
    observer.next(1);
    observer.next(2);
    assert.equal(startCalled, true);
    assert.deepEqual(values, [1, 2]);
  });

  it('reports error if "next" is not a method', () => {
    let observer = getObserver({ next: 1 });
    observer.start();
    observer.next();
    assert.ok(hostError);
  });

  it('does not report error if "next" is undefined', () => {
    let observer = getObserver({ next: undefined });
    observer.start();
    observer.next();
    assert.ok(!hostError);
  });

  it('does not report error if "next" is null', () => {
    let observer = getObserver({ next: null });
    observer.start();
    observer.next();
    assert.ok(!hostError);
  });

  it('reports error if "next" throws', () => {
    let error = {};
    let observer = getObserver({ next() { throw error } });
    observer.start();
    observer.next();
    assert.equal(hostError, error);
  });

  it('does not close the subscription on error', () => {
    let observer = getObserver({ next() { throw {} } });
    observer.start();
    observer.next();
    assert.equal(observer.closed, false);
  });

});
