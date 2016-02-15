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

// === Spec Helpers ===

function getMethod(obj, key) {

    let value = obj[key];

    if (value == null)
        return undefined;

    if (typeof value !== "function")
        throw new TypeError(value + " is not a function");

    return value;
}

function getSpecies(x) {

    let symbol = getSymbol("species"),
        ctor = x.constructor;

    return symbol ? ctor[symbol] : ctor;
}

function addMethods(target, methods) {

    Object.keys(methods).forEach(k => {

        let desc = Object.getOwnPropertyDescriptor(methods, k);
        desc.enumerable = false;
        Object.defineProperty(target, k, desc);
    });
}

// === CancelToken ===

function CancelError() {
    // TODO: This should be an actual subclass of Error
    return new Error("Operation cancelled");
}

export function CancelToken(init) {

    if (typeof init !== "function")
        throw new TypeError(init + " is not a function");

    let resolve;

    this._requested = false;
    this._promise = new Promise(r => resolve = r);
    init(_=> { this._requested = true; resolve(new CancelError()); });
}

addMethods(CancelToken.prototype, {

    get requested() { return this._requested },
    get promise() { return this._promise },
    throwIfRequested() { if (this._requested) throw new CancelError() },
});

// === Observable! ===

export function Observable(subscribe) {

    // The stream subscriber must be a function
    if (typeof subscribe !== "function")
        throw new TypeError("Observable initializer must be a function");

    this._subscribe = subscribe;
}

addMethods(Observable.prototype, {

    forEach(fn, cancelToken) {

        return new Promise((resolve, reject) => {

            function next(x) {

                if (!initialized)
                    throw new Error("Cannot send data before initialization is complete");

                if (!token.requested)
                    fn(x);

                // TODO: What if fn throws an error?  Should we request cancellation?
            }

            if (typeof fn !== "function")
                throw new TypeError(fn + " is not a function");

            let initialized = false,
                requestCancel;

            const token = new CancelToken(c => requestCancel = c);

            if (cancelToken != null) {

                cancelToken.throwIfRequested();
                cancelToken.promise.then(requestCancel);
            }

            this._subscribe.call(undefined, next, token).then(
                val => { requestCancel(); resolve(val); },
                err => { requestCancel(); reject(err); });

            initialized = true;
        });
    },

    filter(fn) {

        if (typeof fn !== "function")
            throw new TypeError(fn + " is not a function");

        let C = getSpecies(this);
        return new C((next, cancelToken) => this.forEach(x => fn(x) && next(x), cancelToken));
    },

    map(fn) {

        if (typeof fn !== "function")
            throw new TypeError(fn + " is not a function");

        let C = getSpecies(this);
        return new C((next, cancelToken) => this.forEach(x => next(fn(x)), cancelToken));
    },

});

addMethods(Observable, {

    from(x) {

        let C = typeof this === "function" ? this : Observable;

        if (x == null) // or undefined
            throw new TypeError(x + " is not an object");

        let method = getMethod(x, getSymbol("observable"));

        if (method) {

            let observable = method.call(x);

            if (Object(observable) !== observable)
                throw new TypeError(observable + " is not an object");

            if (observable.constructor === C)
                return observable;

            return new C(::observable.forEach);
        }

        return new C(async (next, cancelToken) => {

            cancelToken.throwIfRequested();

            for await (let item of args) {

                cancelToken.throwIfRequested();
                next(item);
            }
        });
    },

    of(...args) {

        let C = typeof this === "function" ? this : Observable;

        return new C(async (next, cancelToken) => {

            cancelToken.throwIfRequested();

            for await (let item of args) {

                cancelToken.throwIfRequested();
                next(item);
            }
        });
    },

});

Object.defineProperty(Observable, getSymbol("species"), {
    get() { return this },
    configurable: true,
});
