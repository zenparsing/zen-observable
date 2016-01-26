function takeUntil(control) {

    return new Observable((next, cancel) => new Promise((resolve, reject) => {
        this.forEach(next, cancel).then(resolve, reject);
        // TODO: Always resolve with undefined in this case?
        control.forEach(resolve, cancel).catch(reject);
    }));
}

function switch() {

    return new Observable((next, cancel) => new Promise((resolve, reject) => {

        let innerCancel, innerPromise;

        this.forEach(inner => {

            if (innerCancel)
                innerCancel();

            let token = new CancelToken(r => cancel.promise.then(innerCancel = r));
            innerPromise = inner.forEach(next, token).catch(reject);

        }, cancel).then(x => innerPromise.then(_=> resolve(x)), reject);

    }));
}

function listen(eventName) {

    return new Observable((next, cancel) => {

        this.addEventListener(eventName, next);
        return cancel.promise.then(_=> this.removeEventListener(eventName, next));
    });
}

function merge() {

    return new Observable((next, cancel) => new Promise((resolve, reject) => {

        let innerPromises = [];

        this.forEach(inner => {

            // TODO: Probably want to remove from _innerPromises_ list after done
            innerPromises.push(inner.forEach(next, cancel).catch(reject));

        }, cancel).then(x => Promise.all(innerPromises).then(_=> resolve(x)), reject);
    }));
}

function concat() {

    return new Observable((next, cancel) => new Promise((resolve, reject) => {

        let innerPromise = Promise.resolve();

        this.forEach(inner => {

            innerPromise = innerPromise.then(_=> inner.forEach(next, cancel).catch(reject));

        }, cancel).then(x => innerPromise.then(_=> resolve(x)), reject);
    }));
}

function exhaust() {

    return new Observable((next, cancel) => new Promise((resolve, reject) => {

        let innerPromise = Promise.resolve();

        this.forEach(inner => {

            if (innerPromise)
                return;

            innerPromise = inner.forEach(next, cancel).then(_=> innerPromise = null, reject);

        }, cancel).then(x => innerPromise.then(_=> resolve(x)), reject);
    }));
}

function pairwise() {

    return new Observable((next, cancel) => {

        let none = {}, prev = none;

        return this.forEach(x => {

            if (prev !== none)
                next([prev, x]);

            prev = x;

        }, cancel);
    });
}

function find(fn) {

    return new Observable((next, cancel) => new Promise((resolve, reject) => {

        this.forEach(x => {

            if (fn(x))
                resolve(x);

        }, cancel).then(x => resolve(), reject);

    }));
}

function findIndex(fn) {

    return new Observable((next, cancel) => new Promise((resolve, reject) => {

        let i = -1;

        this.forEach(x => {

            i++;

            if (fn(x))
                resolve(i);

        }, cancel).then(x => resolve(-1), reject);

    }));
}
