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

function cleanupSubscription(subscription) {
  // Assert:  observer._observer is undefined

  let cleanup = subscription._cleanup;

  if (!cleanup)
    return;

  // Drop the reference to the cleanup function so that we won't call it
  // more than once
  subscription._cleanup = undefined;

  // Call the cleanup function
  cleanup();
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

function cleanupFromSubscription(subscription) {
  return () => { subscription.unsubscribe() };
}

function Subscription(observer, subscriber) {
  // Assert: subscriber is callable

  // The observer must be an object
  if (Object(observer) !== observer)
    throw new TypeError("Observer must be an object");

  this._cleanup = undefined;
  this._observer = observer;

  let start = getMethod(observer, "start");

  if (start)
    start.call(observer, this);

  if (subscriptionClosed(this))
    return;

  observer = new SubscriptionObserver(this);

  try {
    // Call the subscriber function
    let cleanup = subscriber.call(undefined, observer);

    // The return value must be undefined, null, a subscription object, or a function
    if (cleanup != null) {
      if (typeof cleanup.unsubscribe === "function")
        cleanup = cleanupFromSubscription(cleanup);
      else if (typeof cleanup !== "function")
        throw new TypeError(cleanup + " is not a function");

      this._cleanup = cleanup;
    }
  } catch (e) {
    // If an error occurs during startup, then attempt to send the error
    // to the observer
    observer.error(e);
    return;
  }

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
      return undefined;

    let observer = subscription._observer;
    let m = getMethod(observer, "next");

    // If the observer doesn't support "next", then return undefined
    if (!m)
      return undefined;

    // Send the next value to the sink
    return m.call(observer, value);
  },

  error(value) {
    let subscription = this._subscription;

    // If the stream is closed, throw the error to the caller
    if (subscriptionClosed(subscription))
      throw value;

    let observer = subscription._observer;
    subscription._observer = undefined;

    try {
      let m = getMethod(observer, "error");

      // If the sink does not support "error", then throw the error to the caller
      if (!m)
        throw value;

      value = m.call(observer, value);
    } catch (e) {
      try { cleanupSubscription(subscription) }
      finally { throw e }
    }

    cleanupSubscription(subscription);
    return value;
  },

  complete(value) {
    let subscription = this._subscription;

    // If the stream is closed, then return undefined
    if (subscriptionClosed(subscription))
      return undefined;

    let observer = subscription._observer;
    subscription._observer = undefined;

    try {
      let m = getMethod(observer, "complete");

      // If the sink does not support "complete", then return undefined
      value = m ? m.call(observer, value) : undefined;
    } catch (e) {
      try { cleanupSubscription(subscription) }
      finally { throw e }
    }

    cleanupSubscription(subscription);
    return value;
  },

});

export function Observable(subscriber) {
  // The stream subscriber must be a function
  if (typeof subscriber !== "function")
    throw new TypeError("Observable initializer must be a function");

  this._subscriber = subscriber;
}

addMethods(Observable.prototype, {

  subscribe(observer, ...args) {
    if (typeof observer === 'function') {
      observer = {
        next: observer,
        error: args[0],
        complete: args[1],
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
          if (Object(subscription) !== subscription)
            throw new TypeError(subscription + " is not an object");

          this._subscription = subscription;
        },

        next(value) {
          let subscription = this._subscription;

          if (subscription.closed)
            return;

          try {
            return fn(value);
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

        return observer.next(value);
      },

      error(e) { return observer.error(e) },
      complete(x) { return observer.complete(x) },
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

        try { if (!fn(value)) return undefined }
        catch (e) { return observer.error(e) }

        return observer.next(value);
      },

      error(e) { return observer.error(e) },
      complete() { return observer.complete() },
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
          observer.error(new TypeError("Cannot reduce an empty sequence"));
          return;
        }

        observer.next(acc);
        observer.complete();
      },

    }));
  },

  flatMap(fn) {
    if (typeof fn !== "function")
      throw new TypeError(fn + " is not a function");

    let C = getSpecies(this);

    return new C(observer => {
      let completed = false;
      let subscriptions = [];

      // Subscribe to the outer Observable
      let outer = this.subscribe({

        next(value) {
          if (fn) {
            try {
              value = fn(value);
            } catch (x) {
              observer.error(x);
              return;
            }
          }

          // Subscribe to the inner Observable
          Observable.from(value).subscribe({
            _subscription: null,

            start(s) { subscriptions.push(this._subscription = s) },
            next(value) { observer.next(value) },
            error(e) { observer.error(e) },

            complete() {
              let i = subscriptions.indexOf(this._subscription);

              if (i >= 0)
                subscriptions.splice(i, 1);

              closeIfDone();
            }
          });
        },

        error(e) {
          return observer.error(e);
        },

        complete() {
          completed = true;
          closeIfDone();
        }
      });

      function closeIfDone() {
        if (completed && subscriptions.length === 0)
          observer.complete();
      }

      return () => {
        subscriptions.forEach(s => s.unsubscribe());
        outer.unsubscribe();
      };
    });
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
        for (let item of method.call(x)) {
          observer.next(item);
          if (observer.closed)
            return;
        }

        observer.complete();
      });
    }

    if (Array.isArray(x)) {
      return new C(observer => {
        for (let i = 0; i < x.length; ++i) {
          observer.next(x[i]);
          if (observer.closed)
            return;
        }

        observer.complete();
      });
    }

    throw new TypeError(x + " is not observable");
  },

  of(...items) {
    let C = typeof this === "function" ? this : Observable;

    return new C(observer => {
      for (let i = 0; i < items.length; ++i) {
        observer.next(items[i]);
        if (observer.closed)
          return;
      }

      observer.complete();
    });
  },

});

Object.defineProperty(Observable, getSymbol("species"), {
  get() { return this },
  configurable: true,
});
