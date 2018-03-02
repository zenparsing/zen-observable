import assert from 'assert';
import { testMethodProperty } from './properties.js';

describe('observer.closed', () => {
  it('is a getter on SubscriptionObserver.prototype', () => {
    let observer;
    new Observable(x => { observer = x }).observe();
    testMethodProperty(Object.getPrototypeOf(observer), 'closed', {
      get: true,
      configurable: true,
      writable: true,
      length: 1
    });
  });

  it('returns false when the subscription is open', () => {
    new Observable(observer => {
      assert.equal(observer.closed, false);
      observer.start();
      assert.equal(observer.closed, false);
    }).observe();
  });

  it('returns true when the subscription is completed', () => {
    let observer;
    new Observable(x => { observer = x; }).observe();
    observer.start();
    observer.complete();
    assert.equal(observer.closed, true);
  });

  it('returns true when the subscription is errored', () => {
    let observer;
    new Observable(x => { observer = x; }).observe(null, () => {});
    observer.start();
    observer.error();
    assert.equal(observer.closed, true);
  });
});
