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
    ctor = ctor[Symbol.species];
    if (ctor === null) {
      ctor = undefined;
    }
  }
  return ctor !== undefined ? ctor : Observable;
}

const $brand = Symbol('observable-brand');
const $subscriber = Symbol('subscriber');

function isObservable(x) {
  return x[$brand] === x; // SPEC: Brand check
}

function enqueue(fn) {
  Promise.resolve().then(() => {
    try { fn() }
    catch (e) { hostReportError(e) }
  });
}

function hostReportError(e) {
  if (hostReportError.log) {
    hostReportError.log(e);
  } else {
    setTimeout(() => { throw e });
  }
}

class Subscription {

  constructor(onNext, onError, onComplete) {
    this.onNext = onNext;
    this.onError = onError,
    this.onComplete = onComplete;
    this.cleanup = undefined;
    this.queue = undefined;
    this.state = 'initializing';
  }

  send(type, value) {
    if (this.state === 'closed')
      return;

    if (this.state === 'buffering') {
      this.queue.push({ type, value });
      return;
    }

    if (this.state !== 'ready') {
      this.state = 'buffering';
      this.queue = [{ type, value }];
      enqueue(() => this.flush());
      return;
    }

    this.triggerCallback(type, value);
  }

  cancel() {
    if (this.state !== 'closed') {
      this.close();
      this.finalize();
    }
  }

  flush() {
    let queue = this.queue;
    if (!queue) return;

    this.queue = undefined;
    this.state = 'ready';
    for (let i = 0; i < queue.length; ++i) {
      this.triggerCallback(queue[i].type, queue[i].value);
      if (this.state === 'closed')
        break;
    }
  }

  triggerCallback(type, value) {
    this.state = 'running';

    // TODO: What is the error handling model?
    // TODO: Should we allow returned values and exceptions? Why not?

    try {
      switch (type) {
        case 'next':
          if (this.onNext) this.onNext(value);
          break;
        case 'error':
          this.close();
          if (this.onError) this.onError(value);
          else throw value;
          break;
        case 'complete':
          this.close();
          if (this.onComplete) this.onComplete(value);
          break;
      }
    } catch (e) {
      hostReportError(e);
    }

    if (this.state === 'closed')
      this.finalize();
    else if (this.state === 'running')
      this.state = 'ready';
  }

  close() {
    this.observer = undefined;
    this.queue = undefined;
    this.state = 'closed';
  }

  finalize() {
    let cleanup = this.cleanup;
    this.cleanup = undefined;
    if (!cleanup)
      return;

    try {
      cleanup();
    } catch (e) {
      hostReportError(e);
    }
  }
}

export class Observable {

  constructor(subscriber) {
    if (!(this instanceof Observable))
      throw new TypeError('Observable cannot be called as a function');

    if (typeof subscriber !== 'function')
      throw new TypeError('Observable initializer must be a function');

    this[$subscriber] = subscriber;
    this[$brand] = this;
  }

  observe(onNext, onError, onComplete) {
    let subscription = new Subscription(onNext, onError, onComplete);

    try {
      subscription.cleanup = this[$subscriber].call(undefined,
        x => subscription.send('next', x),
        x => subscription.send('error', x),
        x => subscription.send('complete', x)
      );
    } catch (e) {
      subscription.send('complete', e);
    }

    if (subscription.state === 'initializing')
      subscription.state = 'ready';

    return () => subscription.cancel();
  }

  forEach(fn) {
    return new Promise((resolve, reject) => {
      if (typeof fn !== 'function') {
        reject(new TypeError(fn + ' is not a function'));
        return;
      }

      let unobserve = this.observe(value => {
        try {
          fn(value);
        } catch (e) {
          reject(e);
          unobserve();
        }
      }, reject, resolve);
    });
  }

  map(fn) {
    if (typeof fn !== 'function')
      throw new TypeError(fn + ' is not a function');

    let C = getSpecies(this);

    return new C((next, error, complete) => this.observe(value => {
      try { value = fn(value) }
      catch (e) { return error(e) }
      next(value);
    }, error, complete));
  }

  filter(fn) {
    if (typeof fn !== 'function')
      throw new TypeError(fn + ' is not a function');

    let C = getSpecies(this);

    return new C((next, error, complete) => this.observe(value => {
      try { if (!fn(value)) return; }
      catch (e) { return error(e) }
      next(value);
    }, error, complete));
  }

  reduce(fn) {
    if (typeof fn !== 'function')
      throw new TypeError(fn + ' is not a function');

    let C = getSpecies(this);
    let hasSeed = arguments.length > 1;
    let hasValue = false;
    let seed = arguments[1];
    let acc = seed;

    return new C((next, error, complete) => this.observe(
      value => {
        let first = !hasValue;
        hasValue = true;

        if (!first || hasSeed) {
          try { acc = fn(acc, value) }
          catch (e) { return error(e) }
        } else {
          acc = value;
        }
      },
      error,
      () => {
        if (!hasValue && !hasSeed)
          return error(new TypeError('Cannot reduce an empty sequence'));

        next(acc);
        complete();
      }
    ));
  }

  concat(...sources) {
    let C = getSpecies(this);

    return new C((next, error, complete) => {
      let unobserve;
      let index = 0;

      function startSource(source) {
        unobserve = source.observe(next, error, () => {
          if (index === sources.length) {
            unobserve = undefined;
            complete();
          } else {
            startSource(C.from(sources[index++]));
          }
        });
      }

      startSource(this);

      return () => {
        if (unobserve) {
          unobserve();
          unobserve = undefined;
        }
      };
    });
  }

  flatMap(fn) {
    if (typeof fn !== 'function')
      throw new TypeError(fn + ' is not a function');

    let C = getSpecies(this);

    return new C((next, error, complete) => {
      let list = [];
      let outerComplete = false;

      let unobserve = this.observe(
        value => {
          if (fn) {
            try { value = fn(value) }
            catch (e) { return error(e) }
          }

          let inner = C.from(value).observe(
            next,
            error,
            () => {
              let i = list.indexOf(inner);
              if (i >= 0) list.splice(i, 1);
              completeIfDone();
            }
          );

          list.push(inner);
        },
        error,
        () => {
          outerComplete = true;
          completeIfDone();
        }
      );

      function completeIfDone() {
        if (outerComplete && list.length === 0)
          complete();
      }

      return () => {
        list.forEach(cancel => cancel());
        unobserve();
      };
    });
  }

  static from(x) {
    let C = typeof this === 'function' ? this : Observable;

    if (x == null)
      throw new TypeError(x + ' is not an object');

    if (isObservable(x) && x.constructor === C)
      return x;

    let method;

    method = getMethod(x, 'observe');
    if (method)
      return new C((next, error, complete) => method.call(x, next, error, complete));

    method = getMethod(x, Symbol.iterator);
    if (method) {
      return new C((next, error, complete) => {
        let closed = false;

        enqueue(() => {
          if (closed) return;
          for (let item of method.call(x)) {
            next(item);
            if (closed) return;
          }
          complete();
        });

        return () => { closed = true };
      });
    }

    throw new TypeError(x + ' is not observable');
  }

  static of(...items) {
    let C = typeof this === 'function' ? this : Observable;

    return new C((next, error, complete) => {
      let closed = false;

      enqueue(() => {
        if (closed) return;
        for (let item of items) {
          next(item);
          if (closed) return;
        }
        complete();
      });

      return () => { closed = true };
    });
  }

  static get [Symbol.species]() { return this }

}

Object.defineProperty(Observable, Symbol('extensions'), {
  value: {
    hostReportError,
  },
  configurable: true,
});
