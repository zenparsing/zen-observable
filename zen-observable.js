/*=esdown=*/(function(fn, name) { if (typeof exports !== 'undefined') fn(exports, module); else if (typeof self !== 'undefined') fn(name === '*' ? self : (name ? self[name] = {} : {})); })(function(exports, module) { 'use strict'; // === Job Queueing ===
var enqueueJob = (function(_) {

    // Node
    if (typeof global !== "undefined" &&
        typeof process !== "undefined" &&
        process.nextTick) {

        return global.setImmediate ?
            function(fn) { return void global.setImmediate(fn); } :
            function(fn) { return void process.nextTick(fn); };
    }

    // Browsers
    return function(fn) { return void Promise.resolve().then(function(_) {
        try { fn() }
        catch (e) { setTimeout(function(_) { throw e }, 0) }
    }); };

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

    var value = obj[key];

    if (value == null)
        return undefined;

    if (typeof value !== "function")
        throw new TypeError(value + " is not a function");

    return value;
}

function getSpecies(ctor) {

    var symbol = getSymbol("species");
    return symbol ? ctor[symbol] : ctor;
}

function addMethods(target, methods) {

    Object.keys(methods).forEach(function(k) {

        var desc = Object.getOwnPropertyDescriptor(methods, k);
        desc.enumerable = false;
        Object.defineProperty(target, k, desc);
    });
}

function cleanupSubscription(subscription) {

    // Assert:  observer._observer is undefined

    var cleanup = subscription._cleanup;

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
    return function(_) { subscription.unsubscribe() };
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
        var cleanup$0 = subscriber.call(undefined, observer);

        // The return value must be undefined, null, a subscription object, or a function
        if (cleanup$0 != null) {

            if (typeof cleanup$0.unsubscribe === "function")
                cleanup$0 = cleanupFromSubscription(cleanup$0);
            else if (typeof cleanup$0 !== "function")
                throw new TypeError(cleanup$0 + " is not a function");

            this._cleanup = cleanup$0;
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
    unsubscribe: function() { closeSubscription(this) }
});

function SubscriptionObserver(subscription) {
    this._subscription = subscription;
}

addMethods(SubscriptionObserver.prototype = {}, {

    next: function(value) {

        var subscription = this._subscription;

        // If the stream if closed, then return undefined
        if (subscriptionClosed(subscription))
            return undefined;

        var observer = subscription._observer;

        try {

            var m$0 = getMethod(observer, "next");

            // If the observer doesn't support "next", then return undefined
            if (!m$0)
                return undefined;

            // Send the next value to the sink
            return m$0.call(observer, value);

        } catch (e) {

            // If the observer throws, then close the stream and rethrow the error
            try { closeSubscription(subscription) }
            finally { throw e }
        }
    },

    error: function(value) {

        var subscription = this._subscription;

        // If the stream is closed, throw the error to the caller
        if (subscriptionClosed(subscription))
            throw value;

        var observer = subscription._observer;
        subscription._observer = undefined;

        try {

            var m$1 = getMethod(observer, "error");

            // If the sink does not support "error", then throw the error to the caller
            if (!m$1)
                throw value;

            value = m$1.call(observer, value);

        } catch (e) {

            try { cleanupSubscription(subscription) }
            finally { throw e }
        }

        cleanupSubscription(subscription);
        return value;
    },

    complete: function(value) {

        var subscription = this._subscription;

        // If the stream is closed, then return undefined
        if (subscriptionClosed(subscription))
            return undefined;

        var observer = subscription._observer;
        subscription._observer = undefined;

        try {

            var m$2 = getMethod(observer, "complete");

            // If the sink does not support "complete", then return undefined
            value = m$2 ? m$2.call(observer, value) : undefined;

        } catch (e) {

            try { cleanupSubscription(subscription) }
            finally { throw e }
        }

        cleanupSubscription(subscription);
        return value;
    },

});

function Observable(subscriber) {

    // The stream subscriber must be a function
    if (typeof subscriber !== "function")
        throw new TypeError("Observable initializer must be a function");

    this._subscriber = subscriber;
}

addMethods(Observable.prototype, {

    subscribe: function(observer) {

        return new Subscription(observer, this._subscriber);
    },

    forEach: function(fn) { var __this = this; 

        return new Promise(function(resolve, reject) {

            if (typeof fn !== "function")
                throw new TypeError(fn + " is not a function");

            var subscription = __this.subscribe({

                next: function(value) {

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

    map: function(fn) { var __this = this; 

        if (typeof fn !== "function")
            throw new TypeError(fn + " is not a function");

        var C = getSpecies(this.constructor);

        return new C(function(observer) { return __this.subscribe({

            next: function(value) {

                try { value = fn(value) }
                catch (e) { return observer.error(e) }

                return observer.next(value);
            },

            error: function(e) { return observer.error(e) },
            complete: function() { return observer.complete() },
        }); });
    },

    filter: function(fn) { var __this = this; 

        if (typeof fn !== "function")
            throw new TypeError(fn + " is not a function");

        var C = getSpecies(this.constructor);

        return new C(function(observer) { return __this.subscribe({

            next: function(value) {

                try { if (!fn(value)) return undefined; }
                catch (e) { return observer.error(e) }

                return observer.next(value);
            },

            error: function(e) { return observer.error(e) },
            complete: function() { return observer.complete() },
        }); });
    },

    reduce: function(fn) { var __this = this; 

        if (typeof fn !== "function")
            throw new TypeError(fn + " is not a function");

        var C = getSpecies(this.constructor),
            hasSeed = arguments.length > 1,
            hasValue = false,
            seed = arguments[1],
            acc = seed;

        return new C(function(observer) { return __this.subscribe({

            next: function(value) {

                var first = !hasValue;
                hasValue = true;

                if (!first || hasSeed) {

                    try { acc = fn(acc, value) }
                    catch (e) { return observer.error(e) }

                } else {

                    acc = value;
                }
            },

            error: function(e) { return observer.error(e) },

            complete: function() {

                if (!hasValue && !hasSeed)
                    observer.error(new TypeError("Cannot reduce an empty sequence"));

                observer.next(acc);
                observer.complete();
            },

        }); });
    },

    flatMap: function(fn) { var __this = this; 

        if (typeof fn !== "function")
            throw new TypeError(fn + " is not a function");

        var C = getSpecies(this.constructor);

        return new C(function(observer) {

            var completed = false,
                subscriptions = [];

            // Subscribe to the outer Observable
            var outer = __this.subscribe({

                next: function(value) {

                    if (fn) {

                        try {

                            value = fn(value);

                        } catch (x) {

                            observer.error(x);
                            return;
                        }
                    }

                    // Subscribe to the inner Observable
                    var subscription = Observable.from(value).subscribe({

                        next: function(value) { observer.next(value) },
                        error: function(e) { observer.error(e) },
                        complete: function() {

                            var i = subscriptions.indexOf(subscription);

                            if (i >= 0)
                                subscriptions.splice(i, 1);

                            closeIfDone();
                        }
                    });

                    subscriptions.push(subscription);
                },

                error: function(e) { return observer.error(e) },

                complete: function() {

                    completed = true;
                    closeIfDone();
                }
            });

            function closeIfDone() {

                if (completed && subscriptions.length === 0)
                    observer.complete();
            }

            return function(_) {

                subscriptions.forEach(function(s) { return s.unsubscribe(); });
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

    from: function(x) {

        var C = typeof this === "function" ? this : Observable;

        if (x == null)
            throw new TypeError(x + " is not an object");

        var method = getMethod(x, getSymbol("observable"));

        if (method) {

            var observable$0 = method.call(x);

            if (Object(observable$0) !== observable$0)
                throw new TypeError(observable$0 + " is not an object");

            if (observable$0.constructor === C)
                return observable$0;

            return new C(function(observer) { return observable$0.subscribe(observer); });
        }

        return new C(function(observer) {

            var done = false;

            enqueueJob(function(_) {

                if (done)
                    return;

                // Assume that the object is iterable.  If not, then the observer
                // will receive an error.
                try {

                    if (hasSymbol("iterator")) {

                        for (var __$0 = (x)[Symbol.iterator](), __$1; __$1 = __$0.next(), !__$1.done;) { var item$0 = __$1.value; 

                            observer.next(item$0);

                            if (done)
                                return;
                        }

                    } else {

                        if (!Array.isArray(x))
                            throw new Error(x + " is not an Array");

                        for (var i$0 = 0; i$0 < x.length; ++i$0) {

                            observer.next(x[i$0]);

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

            return function(_) { done = true };
        });
    },

    of: function() { for (var items = [], __$0 = 0; __$0 < arguments.length; ++__$0) items.push(arguments[__$0]); 

        var C = typeof this === "function" ? this : Observable;

        return new C(function(observer) {

            var done = false;

            enqueueJob(function(_) {

                if (done)
                    return;

                for (var i$1 = 0; i$1 < items.length; ++i$1) {

                    observer.next(items[i$1]);

                    if (done)
                        return;
                }

                observer.complete();
            });

            return function(_) { done = true };
        });
    },

});

Object.defineProperty(Observable, getSymbol("species"), {
    get: function() { return this },
    configurable: true,
});

exports.Observable = Observable;


}, "*");