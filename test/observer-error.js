import assert from 'assert';
import { testMethodProperty } from './properties.js';

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
    observer.start();
    observer.error(1);
    assert.deepEqual(args, [1]);
  });

  it('does not return a value', () => {
    let observer = getObserver({ error() { return 1 } });
    observer.start();
    assert.equal(observer.error(), undefined);
  });

  it('does not throw when the subscription is complete', () => {
    let observer = getObserver({ error() {} });
    observer.start();
    observer.complete();
    observer.error('error');
  });

  it('does not throw when the subscription is cancelled', () => {
    let cancel;
    let observer = getObserver({
      start(c) { cancel = c },
      error() {},
    });
    observer.start();
    cancel();
    observer.error(1);
    assert.ok(!hostError);
  });

  it('calls start if the subscription is not initialized', () => {
    let error;
    let startCalled = false;
    let observer = getObserver({
      start() { startCalled = true },
      error(err) { error = err },
    });
    observer.error(1);
    assert.equal(startCalled, true);
    assert.equal(error, 1);
  });

  it('closes the subscription before invoking inner observer', () => {
    let closed;
    let observer = getObserver({
      error() { closed = observer.closed },
    });
    observer.start();
    observer.error(1);
    assert.equal(closed, true);
  });

  it('reports an error if "error" is not a method', () => {
    let observer = getObserver({ error: 1 });
    observer.start();
    observer.error(1);
    assert.ok(hostError);
  });

  it('reports an error if "error" is undefined', () => {
    let error = {};
    let observer = getObserver({ error: undefined });
    observer.start();
    observer.error(error);
    assert.equal(hostError, error);
  });

  it('reports an error if "error" is null', () => {
    let error = {};
    let observer = getObserver({ error: null });
    observer.start();
    observer.error(error);
    assert.equal(hostError, error);
  });

  it('reports error if "error" throws', () => {
    let error = {};
    let observer = getObserver({ error() { throw error } });
    observer.start();
    observer.error(1);
    assert.equal(hostError, error);
  });

  it('calls the cleanup method after "error"', () => {
    let calls = [];
    let observer = getObserver({
      error() { calls.push('error') },
    });
    observer.start(() => { calls.push('cleanup') });
    observer.error();
    assert.deepEqual(calls, ['error', 'cleanup']);
  });

  it('calls the cleanup method if there is no "error"', () => {
    let calls = [];
    let observer = getObserver();
    observer.start(() => { calls.push('cleanup') });
    observer.error();
    assert.deepEqual(calls, ['cleanup']);
  });

  it('reports error if the cleanup function throws', () => {
    let error = {};
    let observer = getObserver();
    observer.start(() => { throw error });
    observer.error(1);
    assert.equal(hostError, error);
  });

});
