// === Symbol Support ===

function hasSymbol(name) {
  return typeof Symbol === 'function' && Boolean(Symbol[name]);
}

function getSymbol(name) {
  return hasSymbol(name) ? Symbol[name] : '@@' + name;
}

// === Abstract Operations ===

function getMethod(obj, key) {
  let value = obj[key];

  if (value == null)
    return undefined;

  if (typeof value !== 'function')
    throw new TypeError(value + ' is not a function');

  return value;
}

function getSpecies(obj) {
  let ctor = obj.constructor;
  if (ctor !== undefined) {
    ctor = ctor[getSymbol('species')];
    if (ctor === null) {
      ctor = undefined;
    }
  }
  return ctor !== undefined ? ctor : Observable;
}

function addMethods(target, methods) {
  Object.keys(methods).forEach(k => {
    let desc = Object.getOwnPropertyDescriptor(methods, k);
    desc.enumerable = false;
    Object.defineProperty(target, k, desc);
  });
}

function enqueue(fn) {
  Promise.resolve().then(() => {
    try { fn() }
    catch (err) { setTimeout(() => { throw err }) }
  });
}

function cleanupSubscription(subscription) {
  // ASSERT: observer._observer is undefined

  let cleanup = subscription._cleanup;
  if (cleanup === undefined)
    return;

  subscription._cleanup = undefined;

  if (!cleanup) {
    return;
  }

  if (typeof cleanup === 'function') {
    cleanup();
  } else {
    let unsubscribe = getMethod(cleanup, 'unsubscribe');
    if (unsubscribe) {
      unsubscribe.call(cleanup);
    }
  }
}

function subscriptionClosed(subscription) {
  return subscription._state === 'closed';
}

function closeSubscription(subscription) {
  subscription._observer = undefined;
  subscription._state = 'closed';
}

function validateSubscription(subscription) {
  // ASSERT: subscription._state !== 'closed'
  switch (subscription._state) {
    case 'ready': break;
    case 'initializing': throw new Error('Subscription is not initialized');
    case 'running': throw new Error('Subscription observer is already running');
  }
}

function Subscription(observer, subscriber) {
  // ASSERT: observer is an object
  // ASSERT: subscriber is callable

  this._cleanup = undefined;
  this._observer = observer;
  this._state = 'initializing';

  let subscriptionObserver = new SubscriptionObserver(this);

  try {
    this._cleanup = subscriber.call(undefined, subscriptionObserver);
  } catch (err) {
    enqueue(() => observer.error(err));
  }

  this._state = 'ready';
}

addMethods(Subscription.prototype = {}, {
  unsubscribe() {
    if (!subscriptionClosed(this)) {
      closeSubscription(this);
      cleanupSubscription(this);
    }
  },
});

function SubscriptionObserver(subscription) {
  this._subscription = subscription;
}

addMethods(SubscriptionObserver.prototype = {}, {

  get closed() { return subscriptionClosed(this._subscription) },

  next(value) {
    let subscription = this._subscription;
    if (subscriptionClosed(subscription))
      return;

    validateSubscription(subscription);

    let observer = subscription._observer;
    let m = getMethod(observer, 'next');
    if (!m) return;

    subscription._state = 'running';

    try {
      m.call(observer, value);
    } finally {
      if (!subscriptionClosed(subscription))
        subscription._state = 'ready';
    }
  },

  error(value) {
    let subscription = this._subscription;
    if (subscriptionClosed(subscription)) {
      throw value;
    }

    validateSubscription(subscription);

    let observer = subscription._observer;
    closeSubscription(subscription);

    try {
      let m = getMethod(observer, 'error');
      if (m) m.call(observer, value);
      else throw value;
    } catch (e) {
      try { cleanupSubscription(subscription) }
      finally { throw e }
    }

    cleanupSubscription(subscription);
  },

  complete() {
    let subscription = this._subscription;
    if (subscriptionClosed(subscription))
      return;

    validateSubscription(subscription);

    let observer = subscription._observer;
    closeSubscription(subscription);

    try {
      let m = getMethod(observer, 'complete');
      if (m) m.call(observer);
    } catch (e) {
      try { cleanupSubscription(subscription) }
      finally { throw e }
    }

    cleanupSubscription(subscription);
  },

});

function Observable(subscriber) {
  if (!(this instanceof Observable))
    throw new TypeError('Observable cannot be called as a function');

  if (typeof subscriber !== 'function')
    throw new TypeError('Observable initializer must be a function');

  this._subscriber = subscriber;
}

addMethods(Observable.prototype, {

  subscribe(observer) {
    if (!observer || typeof observer !== 'object') {
      observer = {
        next: observer,
        error: arguments[1],
        complete: arguments[2],
      };
    }
    return new Subscription(observer, this._subscriber);
  },

  forEach(fn) {
    return new Promise((resolve, reject) => {
      if (typeof fn !== 'function')
        return Promise.reject(new TypeError(fn + ' is not a function'));

      let subscription = this.subscribe({
        next(value) {
          try {
            fn(value);
          } catch (err) {
            reject(err);
            subscription.unsubscribe();
          }
        },
        error: reject,
        complete: resolve,
      });
    });
  },

  map(fn) {
    if (typeof fn !== 'function')
      throw new TypeError(fn + ' is not a function');

    let C = getSpecies(this);

    return new C(observer => this.subscribe({
      next(value) {
        try { value = fn(value) }
        catch (e) { return observer.error(e) }
        observer.next(value);
      },
      error(e) { observer.error(e) },
      complete() { observer.complete() },
    }));
  },

  filter(fn) {
    if (typeof fn !== 'function')
      throw new TypeError(fn + ' is not a function');

    let C = getSpecies(this);

    return new C(observer => this.subscribe({
      next(value) {
        try { if (!fn(value)) return; }
        catch (e) { return observer.error(e) }
        observer.next(value);
      },
      error(e) { observer.error(e) },
      complete() { observer.complete() },
    }));
  },

  reduce(fn) {
    if (typeof fn !== 'function')
      throw new TypeError(fn + ' is not a function');

    let C = getSpecies(this);
    let hasSeed = arguments.length > 1;
    let hasValue = false;
    let seed = arguments[1];
    let acc = seed;

    return new C(observer => this.subscribe({

      next(value) {
        let first = !hasValue;
        hasValue = true;

        if (!first || hasSeed) {
          try { acc = fn(acc, value) }
          catch (e) { return observer.error(e) }
        } else {
          acc = value;
        }
      },

      error(e) { observer.error(e) },

      complete() {
        if (!hasValue && !hasSeed)
          return observer.error(new TypeError('Cannot reduce an empty sequence'));

        observer.next(acc);
        observer.complete();
      },

    }));
  },

});

Object.defineProperty(Observable.prototype, getSymbol('observable'), {
  value: function() { return this },
  writable: true,
  configurable: true,
});

addMethods(Observable, {

  from(x) {
    let C = typeof this === 'function' ? this : Observable;

    if (x == null)
      throw new TypeError(x + ' is not an object');

    let method = getMethod(x, getSymbol('observable'));
    if (method) {
      let observable = method.call(x);

      if (Object(observable) !== observable)
        throw new TypeError(observable + ' is not an object');

      if (observable.constructor === C) // SPEC: Brand check?
        return observable;

      return new C(observer => observable.subscribe(observer));
    }

    if (hasSymbol('iterator')) {
      method = getMethod(x, getSymbol('iterator'));
      if (method) {
        return new C(observer => {
          enqueue(() => {
            if (observer.closed) return;
            for (let item of method.call(x)) {
              observer.next(item);
              if (observer.closed) return;
            }
            observer.complete();
          });
        });
      }
    }

    if (Array.isArray(x)) {
      return new C(observer => {
        enqueue(() => {
          if (observer.closed) return;
          for (let i = 0; i < x.length; ++i) {
            observer.next(x[i]);
            if (observer.closed) return;
          }
          observer.complete();
        });
      });
    }

    throw new TypeError(x + ' is not observable');
  },

  of(...items) {
    let C = typeof this === 'function' ? this : Observable;

    return new C(observer => {
      enqueue(() => {
        if (observer.closed) return;
        for (let i = 0; i < items.length; ++i) {
          observer.next(items[i]);
          if (observer.closed) return;
        }
        observer.complete();
      });
    });
  },

});

Object.defineProperty(Observable, getSymbol('species'), {
  get() { return this },
  configurable: true,
});

module.exports = Observable;
