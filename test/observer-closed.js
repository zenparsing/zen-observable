const Observable = require('../src/Observable');
const assert = require('assert');
const { testMethodProperty } = require('./properties');

describe('observer.closed', () => {
  it('is a getter on SubscriptionObserver.prototype', () => {
    let observer;
    new Observable(x => { observer = x }).subscribe();
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
    }).subscribe();
  });

  it('returns true when the subscription is completed', async () => {
    let observer;
    new Observable(x => { observer = x; }).subscribe();
    await null;
    observer.complete();
    assert.equal(observer.closed, true);
  });

  it('returns true when the subscription is errored', async () => {
    let observer;
    new Observable(x => { observer = x; }).subscribe(null, () => {});
    await null;
    observer.error();
    assert.equal(observer.closed, true);
  });
});
