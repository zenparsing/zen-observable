// === Symbol Support ===

const hasSymbols = () => typeof Symbol === 'function';
const hasSymbol = name => hasSymbols() && Boolean(Symbol[name]);
const getSymbol = name => hasSymbol(name) ? Symbol[name] : '@@' + name;

if (hasSymbols() && !hasSymbol('subscribe')) {
  Symbol.subscribe = Symbol('subscribe');
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

function isObservable(x) {
  return x instanceof Observable; // SPEC: Brand check
}

function hostReportError(e) {
  if (hostReportError.log) {
    hostReportError.log(e);
  } else {
    setTimeout(() => { throw e });
  }
}

function cleanupSubscription(subscription) {
  let cleanup = subscription._cleanup;
  if (cleanup === undefined)
    return;

  subscription._cleanup = undefined;

  try {
    if (typeof cleanup === 'function')
      cleanup();
  } catch (e) {
    hostReportError(e);
  }
}

function subscriptionOpen(subscription) {
  if (subscription._state === 'initializing')
    subscription.start();

  return subscription._state === 'ready';
}

function closeSubscription(subscription) {
  subscription._observer = undefined;
  subscription._state = 'closed';
}

class SubscriptionObserver {

  constructor(observer) {
    if (observer === null || observer === undefined)
      observer = {};

    this._cleanup = undefined;
    this._observer = observer;
    this._state = 'initializing';
  }

  get closed() {
    return this._state === 'closed';
  }

  start(cleanup) {
    if (this._state !== 'initializing')
      return;

    this._state = 'ready';
    this._cleanup = cleanup;

    let observer = this._observer;

    let unsubscribe = () => {
      if (this._state !== 'closed') {
        closeSubscription(this);
        cleanupSubscription(this);
      }
    };

    try {
      let m = getMethod(observer, 'start');
      if (m) m.call(observer, unsubscribe);
    } catch (e) {
      hostReportError(e);
    }

    if (this._state === 'closed')
      cleanupSubscription(this);
  }

  next(value) {
    if (!subscriptionOpen(this))
      return;

    let observer = this._observer;

    try {
      let m = getMethod(observer, 'next');
      if (m) m.call(observer, value);
    } catch (e) {
      hostReportError(e);
    }

    if (this._state === 'closed')
      cleanupSubscription(this);
  }

  error(value) {
    if (!subscriptionOpen(this))
      return;

    let observer = this._observer;
    closeSubscription(this);

    try {
      let m = getMethod(observer, 'error');
      if (m) m.call(observer, value);
      else throw value;
    } catch (e) {
      hostReportError(e);
    }

    cleanupSubscription(this);
  }

  complete() {
    if (!subscriptionOpen(this))
      return;

    let observer = this._observer;
    closeSubscription(this);

    try {
      let m = getMethod(observer, 'complete');
      if (m) m.call(observer);
    } catch (e) {
      hostReportError(e);
    }

    cleanupSubscription(this);
  }
}

export class Observable {

  constructor(subscriber) {
    if (!(this instanceof Observable))
      throw new TypeError('Observable cannot be called as a function');

    if (typeof subscriber !== 'function')
      throw new TypeError('Observable initializer must be a function');

    this._subscriber = subscriber;
  }

  subscribe(observer) {
    let subscriptionObserver = new SubscriptionObserver(observer);

    try {
      this._subscriber.call(undefined, subscriptionObserver);
    } catch (e) {
      subscriptionObserver.error(e);
    }
  }

  [getSymbol('subscribe')](observer) {
    return this.subscribe(observer);
  }

  forEach(fn) {
    return new Promise((resolve, reject) => {
      if (typeof fn !== 'function') {
        reject(new TypeError(fn + ' is not a function'));
        return;
      }

      function done() {
        resolve();
        cancel();
      }

      let cancel = null;

      this.subscribe({
        start(c) { cancel = c },
        next(value) {
          try {
            fn(value, done);
          } catch (e) {
            reject(e);
            cancel();
          }
        },
        error: reject,
        complete: resolve,
      });
    });
  }

  map(fn) {
    if (typeof fn !== 'function')
      throw new TypeError(fn + ' is not a function');

    let C = getSpecies(this);

    return new C(observer => this.subscribe({
      start(cancel) { observer.start(cancel) },
      next(value) {
        try { value = fn(value) }
        catch (e) { return observer.error(e) }
        observer.next(value);
      },
      error(e) { observer.error(e) },
      complete() { observer.complete() },
    }));
  }

  filter(fn) {
    if (typeof fn !== 'function')
      throw new TypeError(fn + ' is not a function');

    let C = getSpecies(this);

    return new C(observer => this.subscribe({
      start(cancel) { observer.start(cancel) },
      next(value) {
        try { if (!fn(value)) return; }
        catch (e) { return observer.error(e) }
        observer.next(value);
      },
      error(e) { observer.error(e) },
      complete() { observer.complete() },
    }));
  }

  reduce(fn) {
    if (typeof fn !== 'function')
      throw new TypeError(fn + ' is not a function');

    let C = getSpecies(this);
    let hasSeed = arguments.length > 1;
    let hasValue = false;
    let seed = arguments[1];
    let acc = seed;

    return new C(observer => this.subscribe({

      start(cancel) { observer.start(cancel) },

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
  }

  concat(...sources) {
    let C = getSpecies(this);

    return new C(observer => {
      let cancel;

      observer.start(() => {
        if (cancel) {
          cancel = undefined;
          cancel();
        }
      });

      function startNext(next) {
        next.subscribe({
          start(c) { cancel = c },
          next(v) { observer.next(v) },
          error(e) { observer.error(e) },
          complete() {
            if (sources.length === 0) {
              cancel = undefined;
              observer.complete();
            } else {
              startNext(C.from(sources.shift()));
            }
          },
        });
      }

      startNext(this);
    });
  }

  flatMap(fn) {
    if (typeof fn !== 'function')
      throw new TypeError(fn + ' is not a function');

    let C = getSpecies(this);

    return new C(observer => {
      let outerComplete = false;
      let innerObservers = [];

      function completeIfDone() {
        if (outerComplete && innerObservers.length === 0)
          observer.complete();
      }

      this.subscribe({
        start(cancel) {
          observer.start(() => {
            innerObservers.forEach(observer => observer.cancel());
            cancel();
          });
        },
        next(value) {
          try { value = fn(value) }
          catch (e) { return observer.error(e) }

          C.from(value).subscribe({
            cancel: null,
            start(c) {
              this.cancel = c;
              innerObservers.push(this);
            },
            next(value) {
              observer.next(value);
            },
            error(e) {
              observer.error(e);
            },
            complete() {
              let i = innerObservers.indexOf(this);
              if (i >= 0) innerObservers.splice(i, 1);
              completeIfDone();
            },
          });
        },
        error(e) {
          observer.error(e);
        },
        complete() {
          outerComplete = true;
          completeIfDone();
        },
      });
    });
  }

  static from(x) {
    let C = typeof this === 'function' ? this : Observable;

    if (x == null)
      throw new TypeError(x + ' is not an object');

    if (isObservable(x) && x.constructor === C)
      return x;

    let method = getMethod(x, getSymbol('subscribe'));
    if (method)
      return new C(observer => method.call(x, observer));

    if (hasSymbol('iterator')) {
      method = getMethod(x, getSymbol('iterator'));
      if (method) {
        return new C(observer => {
          observer.start();
          if (observer.closed) return;
          for (let item of method.call(x)) {
            observer.next(item);
            if (observer.closed) return;
          }
          observer.complete();
        });
      }
    }

    if (Array.isArray(x)) {
      return new C(observer => {
        observer.start();
        if (observer.closed) return;
        for (let i = 0; i < x.length; ++i) {
          observer.next(x[i]);
          if (observer.closed) return;
        }
        observer.complete();
      });
    }

    throw new TypeError(x + ' is not observable');
  }

  static of(...items) {
    let C = typeof this === 'function' ? this : Observable;

    return new C(observer => {
      observer.start();
      if (observer.closed) return;
      for (let i = 0; i < items.length; ++i) {
        observer.next(items[i]);
        if (observer.closed) return;
      }
      observer.complete();
    });
  }

  static get [getSymbol('species')]() {
    return this;
  }

}

if (hasSymbols()) {
  Object.defineProperty(Observable, Symbol('extensions'), {
    value: {
      symbol: getSymbol('observable'),
      hostReportError,
    },
    configurabe: true,
  });
}
