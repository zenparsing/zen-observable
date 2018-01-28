// === Symbol Support ===

function hasSymbol(name) {
  return typeof Symbol === "function" && Boolean(Symbol[name]);
}

function getSymbol(name) {
  return hasSymbol(name) ? Symbol[name] : "@@" + name;
}

// Ponyfill Symbol.observable for interoperability with other libraries
if (typeof Symbol === "function" && !Symbol.observable) {
  Symbol.observable = Symbol("observable");
}

// === Abstract Operations ===

function getMethod(obj, key) {
  let value = obj[key];

  if (value == null)
    return undefined;

  if (typeof value !== "function")
    throw new TypeError(value + " is not a function");

  return value;
}

function getSpecies(obj) {
  let ctor = obj.constructor;
  if (ctor !== undefined) {
    ctor = ctor[getSymbol("species")];
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
  // ASSERT:  observer._observer is undefined

  let cleanup = subscription._cleanup;
  if (cleanup === undefined)
    return;

  // Drop the reference to the cleanup function so that we won't call it
  // more than once
  subscription._cleanup = undefined;

  if (cleanup === null) {
    return;
  }

  // Call the cleanup function
  if (typeof cleanup === "function") {
    cleanup();
  } else {
    let unsubscribe = getMethod(cleanup, "unsubscribe");
    if (unsubscribe) {
      unsubscribe.call(cleanup);
    }
  }
}

function subscriptionClosed(subscription) {
  return subscription._observer === undefined;
}

function closeSubscription(subscription) {
  if (subscriptionClosed(subscription))
    return;

  subscription._observer = undefined;
  cleanupSubscription(subscription);
}

function Subscription(observer, subscriber) {
  // ASSERT: observer is an object
  // ASSERT: subscriber is callable

  this._cleanup = undefined;
  this._observer = observer;

  let start = getMethod(observer, "start");
  if (start) start.call(observer, this);

  if (subscriptionClosed(this))
    return;

  // Call the subscriber function
  this._cleanup = subscriber.call(undefined, new SubscriptionObserver(this));

  // If the stream is already finished, then perform cleanup
  if (subscriptionClosed(this))
    cleanupSubscription(this);
}

addMethods(Subscription.prototype = {}, {
  get closed() { return subscriptionClosed(this) },
  unsubscribe() { closeSubscription(this) },
});

function SubscriptionObserver(subscription) {
  this._subscription = subscription;
}

addMethods(SubscriptionObserver.prototype = {}, {

  get closed() { return subscriptionClosed(this._subscription) },

  next(value) {
    let subscription = this._subscription;

    // If the stream is closed, then return undefined
    if (subscriptionClosed(subscription))
      return;

    let observer = subscription._observer;

    // If the observer has a "next" method, send the next value
    let m = getMethod(observer, "next");
    if (m) m.call(observer, value);
  },

  error(value) {
    let subscription = this._subscription;

    // If the stream is closed, throw the error to the caller
    if (subscriptionClosed(subscription)) {
      throw value;
    }

    let observer = subscription._observer;
    subscription._observer = undefined;

    try {
      let m = getMethod(observer, "error");
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

    let observer = subscription._observer;
    subscription._observer = undefined;

    try {
      let m = getMethod(observer, "complete");
      if (m) m.call(observer);
    } catch (e) {
      try { cleanupSubscription(subscription) }
      finally { throw e }
    }

    cleanupSubscription(subscription);
  },

});

export function Observable(subscriber) {
  // Constructor cannot be called as a function
  if (!(this instanceof Observable))
    throw new TypeError("Observable cannot be called as a function");

  // The stream subscriber must be a function
  if (typeof subscriber !== "function")
    throw new TypeError("Observable initializer must be a function");

  this._subscriber = subscriber;
}

addMethods(Observable.prototype, {

  subscribe(observer) {
    if (!observer || typeof observer !== 'object') {
      observer = {
        next: observer,
        error: arguments[1],
        complete: arguments[2]
      };
    }
    return new Subscription(observer, this._subscriber);
  },

  forEach(fn) {
    return new Promise((resolve, reject) => {
      if (typeof fn !== "function")
        return Promise.reject(new TypeError(fn + " is not a function"));

      this.subscribe({
        _subscription: null,

        start(subscription) {
          this._subscription = subscription;
        },

        next(value) {
          let subscription = this._subscription;

          if (subscription.closed)
            return;

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
    if (typeof fn !== "function")
      throw new TypeError(fn + " is not a function");

    let C = getSpecies(this);

    return new C(observer => this.subscribe({
      next(value) {
        if (observer.closed)
          return;

        try { value = fn(value) }
        catch (e) { return observer.error(e) }

        observer.next(value);
      },

      error(e) { observer.error(e) },
      complete() { observer.complete() },
    }));
  },

  filter(fn) {
    if (typeof fn !== "function")
      throw new TypeError(fn + " is not a function");

    let C = getSpecies(this);

    return new C(observer => this.subscribe({
      next(value) {
        if (observer.closed)
          return;

        try { if (!fn(value)) return }
        catch (e) { return observer.error(e) }

        observer.next(value);
      },

      error(e) { observer.error(e) },
      complete() { observer.complete() },
    }));
  },

  reduce(fn) {
    if (typeof fn !== "function")
      throw new TypeError(fn + " is not a function");

    let C = getSpecies(this);
    let hasSeed = arguments.length > 1;
    let hasValue = false;
    let seed = arguments[1];
    let acc = seed;

    return new C(observer => this.subscribe({

      next(value) {
        if (observer.closed)
          return;

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
        if (!hasValue && !hasSeed) {
          return observer.error(new TypeError("Cannot reduce an empty sequence"));
        }

        observer.next(acc);
        observer.complete();
      },

    }));
  },

});

Object.defineProperty(Observable.prototype, getSymbol("observable"), {
  value: function() { return this },
  writable: true,
  configurable: true,
});

addMethods(Observable, {

  from(x) {
    let C = typeof this === "function" ? this : Observable;

    if (x == null)
      throw new TypeError(x + " is not an object");

    let method = getMethod(x, getSymbol("observable"));

    if (method) {
      let observable = method.call(x);

      if (Object(observable) !== observable)
        throw new TypeError(observable + " is not an object");

      if (observable.constructor === C)
        return observable;

      return new C(observer => observable.subscribe(observer));
    }

    if (hasSymbol("iterator") && (method = getMethod(x, getSymbol("iterator")))) {
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

    if (Array.isArray(x)) {
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
    }

    throw new TypeError(x + " is not observable");
  },

  of(...items) {
    let C = typeof this === "function" ? this : Observable;

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

Object.defineProperty(Observable, getSymbol("species"), {
  get() { return this },
  configurable: true,
});

Object.defineProperty(Observable, "extensions", {
  value: {
    observableSymbol: getSymbol("observable"),
  },
});
