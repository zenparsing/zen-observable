const Observable = require('../src/Observable');
const assert = require('assert');
const { testMethodProperty } = require('./properties');

describe('subscription', () => {

  function getSubscription(subscriber = () => {}) {
    return new Observable(subscriber).subscribe();
  }

  describe('unsubscribe', () => {
    it('is a method on Subscription.prototype', () => {
      let subscription = getSubscription();
      testMethodProperty(Object.getPrototypeOf(subscription), 'unsubscribe', {
        configurable: true,
        writable: true,
        length: 0,
      });
    });

    it('reports an error if the cleanup function throws', () => {
      let error = {};
      let subscription = getSubscription(() => {
        return () => { throw error };
      });
      subscription.unsubscribe();
      assert.equal(hostError, error);
    });
  });

  describe('closed', () => {
    it('is a getter on Subscription.prototype', () => {
      let subscription = getSubscription();
      testMethodProperty(Object.getPrototypeOf(subscription), 'closed', {
        configurable: true,
        writable: true,
        get: true,
      });
    });
  });

});
