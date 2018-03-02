import assert from 'assert';
import { testMethodProperty } from './properties.js';

describe('observer.start', () => {

  function getObserver(inner) {
    let observer;
    new Observable(x => { observer = x }).observe(inner);
    return observer;
  }

  it('is a method of SubscriptionObserver', () => {
    let observer = getObserver();
    testMethodProperty(Object.getPrototypeOf(observer), 'start', {
      configurable: true,
      writable: true,
      length: 1,
    });
  });

  it('reports error if "start" is not a method', () => {
    let observer = getObserver({ start: 1 });
    observer.start();
    assert.ok(hostError);
  });

  it('does not report error if "start" is undefined', () => {
    let observer = getObserver({ start: undefined });
    observer.start();
    assert.ok(!hostError);
  });

  it('does not report error if "start" is null', () => {
    let observer = getObserver({ start: null });
    observer.start();
    assert.ok(!hostError);
  });

  it('reports error if "start" throws', () => {
    let error = {};
    let observer = getObserver({ start() { throw error } });
    observer.start();
    assert.equal(hostError, error);
  });

  it('does not close the subscription on error', () => {
    let observer = getObserver({ start() { throw {} } });
    observer.start();
    assert.equal(observer.closed, false);
  });

});
