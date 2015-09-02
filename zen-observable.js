/*=esdown=*/(function(fn, deps, name) { function obj() { return {} } if (typeof exports !== 'undefined') fn(require, exports, module); else if (typeof define === 'function' && define.amd) define(['require', 'exports', 'module'].concat(deps), fn); else if (typeof self !== 'undefined' && name) fn(obj, name === '*' ? self : (self[name] = {}), {}); else fn(obj, {}, {}); })(function(require, exports, module) { 'use strict'; function __load(p, l) { module.__es6 = !l; var e = require(p); if (e && e.constructor !== Object) e.default = e; return e; } // === Non-Promise Job Queueing ===

var enqueueJob = (function() {

    // Node
    if (typeof global !== "undefined" &&
        typeof process !== "undefined" &&
        process.nextTick) {

        return global.setImmediate ?
            function(fn) { global.setImmediate(fn) } :
            function(fn) { process.nextTick(fn) };
    }

    // Newish Browsers
    var Observer = self.MutationObserver || self.WebKitMutationObserver;

    if (Observer) {

        var div$0 = document.createElement("div"),
            twiddle$0 = function(_) { return div$0.classList.toggle("x"); },
            queue$0 = [];

        var observer$0 = new Observer(function(_) {

            if (queue$0.length > 1)
                twiddle$0();

            while (queue$0.length > 0)
                queue$0.shift()();
        });

        observer$0.observe(div$0, { attributes: true });

        return function(fn) {

            queue$0.push(fn);

            if (queue$0.length === 1)
                twiddle$0();
        };
    }

    // Fallback
    return function(fn) { setTimeout(fn, 0) };

})();

// === Symbol Polyfills ===

function polyfillSymbol(name) {

    if (symbolsSupported() && !Symbol[name])
        Object.defineProperty(Symbol, name, { value: Symbol(name) });
}

function symbolsSupported() {

    return typeof Symbol === "function";
}

function hasSymbol(name) {

    return symbolsSupported() && Boolean(Symbol[name]);
}

function getSymbol(name) {

    return hasSymbol(name) ? Symbol[name] : "@@" + name;
}

polyfillSymbol("observable");

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

function cleanupSubscription(observer) {

    // Assert:  observer._observer is undefined

    var cleanup = observer._cleanup;

    if (!cleanup)
        return;

    // Drop the reference to the cleanup function so that we won't call it
    // more than once
    observer._cleanup = undefined;

    // Call the cleanup function
    cleanup();
}

function subscriptionClosed(observer) {

    return observer._observer === undefined;
}

function SubscriptionObserver(observer, subscriber) {

    // Assert: subscriber is callable

    // The observer must be an object
    if (Object(observer) !== observer)
        throw new TypeError("Observer must be an object");

    this._observer = observer;
    this._cleanup = undefined;

    try {

        // Call the subscriber function
        var cleanup$0 = subscriber.call(undefined, this);

        // The return value must be undefined, null, or a function
        if (cleanup$0 != null && typeof cleanup$0 !== "function")
            throw new TypeError(cleanup$0 + " is not a function");

        this._cleanup = cleanup$0;

    } catch (e) {

        // If an error occurs during startup, then attempt to send the error
        // to the observer
        this.error(e);
        return;
    }

    // If the stream is already finished, then perform cleanup
    if (subscriptionClosed(this))
        cleanupSubscription(this);
}

addMethods(SubscriptionObserver.prototype = {}, {

    cancel: function() {

        if (subscriptionClosed(this))
            return;

        this._observer = undefined;
        cleanupSubscription(this);
    },

    get closed() { return subscriptionClosed(this) },

    next: function(value) {

        // If the stream if closed, then return undefined
        if (subscriptionClosed(this))
            return undefined;

        var observer = this._observer;

        try {

            var m$0 = getMethod(observer, "next");

            // If the observer doesn't support "next", then return undefined
            if (!m$0)
                return undefined;

            // Send the next value to the sink
            return m$0.call(observer, value);

        } catch (e) {

            // If the observer throws, then close the stream and rethrow the error
            try { this.cancel() }
            finally { throw e }
        }
    },

    error: function(value) {

        // If the stream is closed, throw the error to the caller
        if (subscriptionClosed(this))
            throw value;

        var observer = this._observer;
        this._observer = undefined;

        try {

            var m$1 = getMethod(observer, "error");

            // If the sink does not support "error", then throw the error to the caller
            if (!m$1)
                throw value;

            value = m$1.call(observer, value);

        } catch (e) {

            try { cleanupSubscription(this) }
            finally { throw e }
        }

        cleanupSubscription(this);

        return value;
    },

    complete: function(value) {

        // If the stream is closed, then return undefined
        if (subscriptionClosed(this))
            return undefined;

        var observer = this._observer;
        this._observer = undefined;

        try {

            var m$2 = getMethod(observer, "complete");

            // If the sink does not support "complete", then return undefined
            value = m$2 ? m$2.call(observer, value) : undefined;

        } catch (e) {

            try { cleanupSubscription(this) }
            finally { throw e }
        }

        cleanupSubscription(this);

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

        // Wrap the observer in order to maintain observation invariants
        observer = new SubscriptionObserver(observer, this._subscriber);
        return function(_) { observer.cancel() };
    },

    forEach: function(fn) { var __this = this; 

        return new Promise(function(resolve, reject) {

            if (typeof fn !== "function")
                throw new TypeError(fn + " is not a function");

            __this.subscribe({

                next: function(value) {

                    try { return fn(value) }
                    catch (e) { reject(e) }
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

            error: function(value) { return observer.error(value) },
            complete: function(value) { return observer.complete(value) },
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

            error: function(value) { return observer.error(value) },
            complete: function(value) { return observer.complete(value) },
        }); });
    },

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

            enqueueJob(function(_) {

                if (observer.closed)
                    return;

                // Assume that the object is iterable.  If not, then the observer
                // will receive an error.
                try {

                    if (hasSymbol("iterator")) {

                        for (var __$0 = (x)[Symbol.iterator](), __$1; __$1 = __$0.next(), !__$1.done;) { var item$0 = __$1.value; 

                            observer.next(item$0);

                            if (observer.closed)
                                return;
                        }

                    } else {

                        if (!Array.isArray(x))
                            throw new Error(x + " is not an Array");

                        for (var i$0 = 0; i$0 < x.length; ++i$0) {

                            observer.next(x[i$0]);

                            if (observer.closed)
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
        });
    },

    of: function() { for (var items = [], __$0 = 0; __$0 < arguments.length; ++__$0) items.push(arguments[__$0]); 

        var C = typeof this === "function" ? this : Observable;

        return new C(function(observer) {

            enqueueJob(function(_) {

                if (observer.closed)
                    return;

                for (var i$1 = 0; i$1 < items.length; ++i$1) {

                    observer.next(items[i$1]);

                    if (observer.closed)
                        return;
                }

                observer.complete();
            });
        });
    },

});

Object.defineProperty(Observable, getSymbol("species"), {
    get: function() { return this },
    configurable: true,
});

exports.Observable = Observable;


}, [], "*");