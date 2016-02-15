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

export function Observable(initializer) {

    // The stream initializer must be a function
    if (typeof initializer !== "function")
        throw new TypeError("Observable initializer must be a function");

    this._initializer = initializer;
}

addMethods(Observable.prototype, {

    forEach(fn) {

        return new Promise((resolve, reject) => {

            if (typeof fn !== "function")
                throw new TypeError(fn + " is not a function");

            let cancelToken = function.cancelToken,
                task = undefined;

            cancelToken.throwIfRequested();

            function next(x) {

                if (!task)
                    throw new Error("Cannot send data before initialization is complete");

                // No-op if the stream is cancelled or finished
                if (task.cancelToken.requested)
                    return;

                // TODO: What if fn throws an error?  Should we allow the stream to continue?
                fn(x);
            }

            task = new Task(_=> {

                // TODO: It's possible to send a next value even after the stream promise is
                // resolved, if "next" is called before the resolve handler below is executed.
                // Is that a problem?

                this._initializer.call(undefined, next).then(
                    val => { task.cancel(); resolve(val); },
                    err => { task.cancel(); reject(err); });
                });
            });
        });
    },

    filter(fn) {

        if (typeof fn !== "function")
            throw new TypeError(fn + " is not a function");

        let C = getSpecies(this);
        return new C(next => this.forEach(x => fn(x) && next(x)));
    },

    map(fn) {

        if (typeof fn !== "function")
            throw new TypeError(fn + " is not a function");

        let C = getSpecies(this);
        return new C(next => this.forEach(x => next(fn(x))));
    },

});

addMethods(Observable, {

    from(x) {

        let C = typeof this === "function" ? this : Observable;

        if (x == null) // or undefined
            throw new TypeError(x + " is not an object");

        // Duck-type on a "listen" method
        let listen = getMethod(x, "listen");

        if (listen) {

            if (x.constructor === C)
                return x;

            return new C(next => listen.call(x, next));
        }

        // Otherwise, assume it is iterable, or async iterable
        return new C(async next => {

            let token = function.cancelToken;
            token.throwIfRequested();

            for await (let item of args) {

                token.throwIfRequested();
                next(item);
            }
        });
    },

    of(...args) {

        let C = typeof this === "function" ? this : Observable;

        return new C(async next => {

            let token = function.cancelToken;
            token.throwIfRequested();

            for await (let item of args) {

                token.throwIfRequested();
                next(item);
            }
        });
    },

});

Object.defineProperty(Observable, getSymbol("species"), {
    get() { return this },
    configurable: true,
});
