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

// === Observable! ===

export function Observable(subscribe) {

    // The stream subscriber must be a function
    if (typeof subscribe !== "function")
        throw new TypeError("Observable initializer must be a function");

    this._subscribe = subscribe;
}

addMethods(Observable.prototype, {

    forEach(fn) {

        return new Promise((resolve, reject, onCancel) => {

            if (typeof fn !== "function")
                throw new TypeError(fn + " is not a function");

            let initialized = false,
                finished = false,
                cleanups = [];

            function next(x) {

                if (!initialized)
                    throw new Error("Cannot send data before initialization is complete");

                if (!finished)
                    fn(x);

                // TODO: If fn throws an error, should it perform cleanup?  Cancel the
                // inner promise and run the cleanups?
            }

            function doCleanup() {

                finished = true;

                for (let x of cleanups)
                    x();
            }

            function registerCleanup(fn) {

                // TODO: Dedupe, type check
                if (!finished)
                    cleanups.push(fn);
            }

            let p = this._subscribe.call(undefined, next, registerCleanup)
                .then(
                    val => { doCleanup(); return val; },
                    err => { doCleanup(); throw err; })
                .then(resolve, reject);

            onCancel(_=> { p.cancel(); doCleanup(); });
        });
    },

    filter(fn) {

        if (typeof fn !== "function")
            throw new TypeError(fn + " is not a function");

        let C = getSpecies(this);
        return new C((next) => this.forEach(x => fn(x) && next(x)));
    },

    map(fn) {

        if (typeof fn !== "function")
            throw new TypeError(fn + " is not a function");

        let C = getSpecies(this);
        return new C((next) => this.forEach(x => next(fn(x))));
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

        return new C(async (next) => {

            for await (let item of args) {
                next(item);
            }
        });
    },

    of(...args) {

        let C = typeof this === "function" ? this : Observable;

        return new C(async (next) => {

            for await (let item of args) {
                next(item);
            }
        });
    },

});

Object.defineProperty(Observable, getSymbol("species"), {
    get() { return this },
    configurable: true,
});
