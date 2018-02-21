import assert from 'assert';
import { testMethodProperty } from './properties.js';

describe('subscribe', () => {

  function subscribe(observer) {
    let subscriptionObserver;
    new Observable(x => { subscriptionObserver = x }).subscribe(observer);
    return subscriptionObserver;
  }

  it('is a method of Observable.prototype', () => {
    testMethodProperty(Observable.prototype, 'subscribe', {
      configurable: true,
      writable: true,
      length: 1,
    });
  });

  it('accepts an observer argument', () => {
    let nextValue;
    let observer = subscribe({
      next(v) { nextValue = v },
    });
    observer.start();
    observer.next(1);
    assert.equal(nextValue, 1);
  });

  it('reports an error if subscriber throws', () => {
    let errorValue = undefined;
    new Observable(() => { throw error }).subscribe({
      error(e) { errorValue = e },
    });
    assert.ok(hostError);
    assert.equal(errorValue, undefined);
  });

});
