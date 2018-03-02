import assert from 'assert';
import { testMethodProperty } from './properties.js';

describe('observer.complete', () => {

  function getObserver(inner) {
    let observer;
    new Observable(x => { observer = x }).observe(inner);
    return observer;
  }

  it('is a method of SubscriptionObserver', () => {
    let observer = getObserver();
    testMethodProperty(Object.getPrototypeOf(observer), 'complete', {
      configurable: true,
      writable: true,
      length: 0,
    });
  });

  it('does not forward arguments', () => {
    let args;
    let observer = getObserver({ complete(...a) { args = a } });
    observer.start();
    observer.complete(1);
    assert.deepEqual(args, []);
  });

  it('does not return a value', () => {
    let observer = getObserver({ complete() { return 1 } });
    observer.start();
    assert.equal(observer.complete(), undefined);
  });

  it('does not forward when the subscription is complete', () => {
    let count = 0;
    let observer = getObserver({ complete() { count++ } });
    observer.start();
    observer.complete();
    observer.complete();
    assert.equal(count, 1);
  });

  it('does not forward when the subscription is cancelled', () => {
    let count = 0;
    let cancel;
    let observer = getObserver({
      start(c) { cancel = c },
      complete() { count++ },
    });
    observer.start();
    cancel();
    observer.complete();
    assert.equal(count, 0);
  });

  it('calls start if the subscription is not initialized', () => {
    let completed = false;
    let startCalled = false;
    let observer = getObserver({
      start() { startCalled = true },
      complete() { completed = true },
    });
    observer.complete();
    assert.equal(startCalled, true);
    assert.equal(completed, true);
  });

  it('closes the subscription before invoking inner observer', () => {
    let closed;
    let observer = getObserver({
      complete() { closed = observer.closed },
    });
    observer.start();
    observer.complete();
    assert.equal(closed, true);
  });

  it('reports error if "complete" is not a method', () => {
    let observer = getObserver({ complete: 1 });
    observer.start();
    observer.complete();
    assert.ok(hostError instanceof Error);
  });

  it('does not report error if "complete" is undefined', () => {
    let observer = getObserver({ complete: undefined });
    observer.start();
    observer.complete();
    assert.ok(!hostError);
  });

  it('does not report error if "complete" is null', () => {
    let observer = getObserver({ complete: null });
    observer.start();
    observer.complete();
    assert.ok(!hostError);
  });

  it('reports error if "complete" throws', () => {
    let error = {};
    let observer = getObserver({ complete() { throw error } });
    observer.start();
    observer.complete();
    assert.equal(hostError, error);
  });

  it('calls the cleanup method after "complete"', () => {
    let calls = [];
    let observer = getObserver({
      complete() { calls.push('complete') },
    });
    observer.start(() => calls.push('cleanup'));
    observer.complete();
    assert.deepEqual(calls, ['complete', 'cleanup']);
  });

  it('calls the cleanup method if there is no "complete"', () => {
    let calls = [];
    let observer = getObserver();
    observer.start(() => { calls.push('cleanup') });
    observer.complete();
    assert.deepEqual(calls, ['cleanup']);
  });

  it('reports error if the cleanup function throws', () => {
    let error = {};
    let observer = getObserver();
    observer.start(() => { throw error });
    observer.complete();
    assert.equal(hostError, error);
  });
});
