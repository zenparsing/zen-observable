import assert from 'assert';
import { testMethodProperty } from './properties.js';

describe('observe', () => {

  function observe(observer) {
    let managedObserver;
    new Observable(x => { managedObserver = x }).observe(observer);
    return managedObserver;
  }

  it('is a method of Observable.prototype', () => {
    testMethodProperty(Observable.prototype, 'observe', {
      configurable: true,
      writable: true,
      length: 1,
    });
  });

  it('accepts an observer argument', () => {
    let nextValue;
    let observer = observe({
      next(v) { nextValue = v },
    });
    observer.start();
    observer.next(1);
    assert.equal(nextValue, 1);
  });

  it('sends an error if subscriber throws', () => {
    let errorValue;
    let startCalled = false;
    new Observable(() => { throw error }).observe({
      start() { startCalled = true },
      error(e) { errorValue = e },
    });
    assert.equal(startCalled, true);
    assert.ok(errorValue);
  });

});
