// === Job Queueing ===
const enqueueJob = (_=> {

    // Node
    if (typeof global !== "undefined" &&
        typeof process !== "undefined" &&
        process.nextTick) {

        return global.setImmediate ?
            fn => void global.setImmediate(fn) :
            fn => void process.nextTick(fn);
    }

    // Browsers
    return fn => void Promise.resolve().then(_=> {
        try { fn() }
        catch (e) { setTimeout(_=> { throw e }, 0) }
    });

})();

// === Symbol Support ===

function hasSymbol(name) {

    return typeof Symbol === "function" && Boolean(Symbol[name]);
}

function getSymbol(name) {

    return hasSymbol(name) ? Symbol[name] : "@@" + name;
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

function getSpecies(ctor) {

    let symbol = getSymbol("species");
    return symbol ? ctor[symbol] : ctor;
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
    return _=> { subscription.unsubscribe() };
}

function Subscription(observer, subscriber) {

    // Assert: subscriber is callable

    // The observer must be an object
    if (Object(observer) !== observer)
        throw new TypeError("Observer must be an object");

    this._cleanup = undefined;
    this._observer = observer;

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
    unsubscribe() { closeSubscription(this) }
});

function SubscriptionObserver(subscription) {
    this._subscription = subscription;
}

addMethods(SubscriptionObserver.prototype = {}, {

    next(value) {

        let subscription = this._subscription;

        // If the stream if closed, then return undefined
        if (subscriptionClosed(subscription))
            return undefined;

        let observer = subscription._observer;

        try {

            let m = getMethod(observer, "next");

            // If the observer doesn't support "next", then return undefined
            if (!m)
                return undefined;

            // Send the next value to the sink
            return m.call(observer, value);

        } catch (e) {

            // If the observer throws, then close the stream and rethrow the error
            try { closeSubscription(subscription) }
            finally { throw e }
        }
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

    subscribe(observer) {

        return new Subscription(observer, this._subscriber);
    },

    forEach(fn) {

        return new Promise((resolve, reject) => {

            if (typeof fn !== "function")
                throw new TypeError(fn + " is not a function");

            let subscription = this.subscribe({

                next(value) {

                    try {

                        return fn(value);

                    } catch (e) {

                        reject(e);
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

        let C = getSpecies(this.constructor);

        return new C(observer => this.subscribe({

            next(value) {

                try { value = fn(value) }
                catch (e) { return observer.error(e) }

                return observer.next(value);
            },

            error(e) { return observer.error(e) },
            complete() { return observer.complete() },
        }));
    },

    filter(fn) {

        if (typeof fn !== "function")
            throw new TypeError(fn + " is not a function");

        let C = getSpecies(this.constructor);

        return new C(observer => this.subscribe({

            next(value) {

                try { if (!fn(value)) return undefined; }
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

        let C = getSpecies(this.constructor),
            hasSeed = arguments.length > 1,
            hasValue = false,
            seed = arguments[1],
            acc = seed;

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

            error(e) { return observer.error(e) },

            complete() {

                if (!hasValue && !hasSeed)
                    observer.error(new TypeError("Cannot reduce an empty sequence"));

                observer.next(acc);
                observer.complete();
            },

        }));
    },

    flatMap(fn) {

        if (typeof fn !== "function")
            throw new TypeError(fn + " is not a function");

        let C = getSpecies(this.constructor);

        return new C(observer => {

            let completed = false,
                subscriptions = [];

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
                    let subscription = Observable.from(value).subscribe({

                        next(value) { observer.next(value) },
                        error(e) { observer.error(e) },
                        complete() {

                            let i = subscriptions.indexOf(subscription);

                            if (i >= 0)
                                subscriptions.splice(i, 1);

                            closeIfDone();
                        }
                    });

                    subscriptions.push(subscription);
                },

                error(e) { return observer.error(e) },

                complete() {

                    completed = true;
                    closeIfDone();
                }
            });

            function closeIfDone() {

                if (completed && subscriptions.length === 0)
                    observer.complete();
            }

            return _=> {

                subscriptions.forEach(s => s.unsubscribe());
                outer.unsubscribe();
            };
        });
    }

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

        return new C(observer => {

            let done = false;

            enqueueJob(_=> {

                if (done)
                    return;

                // Assume that the object is iterable.  If not, then the observer
                // will receive an error.
                try {

                    if (hasSymbol("iterator")) {

                        for (let item of x) {

                            observer.next(item);

                            if (done)
                                return;
                        }

                    } else {

                        if (!Array.isArray(x))
                            throw new Error(x + " is not an Array");

                        for (let i = 0; i < x.length; ++i) {

                            observer.next(x[i]);

                            if (done)
                                return;
                        }
                    }

                } catch (e) {

                    // If observer.next throws an error, then the subscription will
                    // be closed and the error method will simply rethrow
                    observer.error(e);
                    return;
                }

                observer.complete();
            });

            return _=> { done = true };
        });
    },

    of(...items) {

        let C = typeof this === "function" ? this : Observable;

        return new C(observer => {

            let done = false;

            enqueueJob(_=> {

                if (done)
                    return;

                for (let i = 0; i < items.length; ++i) {

                    observer.next(items[i]);

                    if (done)
                        return;
                }

                observer.complete();
            });

            return _=> { done = true };
        });
    },

});

Object.defineProperty(Observable, getSymbol("species"), {
    get() { return this },
    configurable: true,
});
