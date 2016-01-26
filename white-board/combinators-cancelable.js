function takeUntil(control) {

    return new Observable((next, cleanup) => new Promise((resolve, reject) => {

        cleanup(_=> {
            p.cancel();
            c.cancel();
        });

        let p = this.forEach(next).then(resolve, reject),
            c = control.forEach(resolve).catch(reject);
    });
}

// For a nested stream, emits the elements of the inner stream contained within the
// most recent outer stream
function switch(stream) {

    return new Observable((next, cleanup) => new Promise((resolve, reject) => {

        let inner = null;

        let outer = this.forEach(value => {

            if (inner)
                inner.cancel();

            inner = value.forEach(next).catch(reject);

        }).then(x => innerPromise.then(_=> resolve(x)), reject);

        cleanup(_=> {

            if (inner)
                inner.cancel();

            outer.cancel();
        });
    }));
}

function listen(eventName) {

    return new Observable((next, cleanup) => {
        return new Promise(_=> {
            this.addEventListener(eventName, next);
            cleanup(_=> this.removeEventListener(eventName, next));
        });
    });
}

function merge() {

    return new Observable((next, cleanup) => new Promise((resolve, reject) => {

        let innerPromises = [];

        let p = this.forEach(inner => {

            // TODO: Probably want to remove from _innerPromises_ list after done
            innerPromises.push(inner.forEach(next).catch(reject));

        }).then(x => Promise.all(innerPromises).then(_=> resolve(x)), reject);

        cleanup(_=> {
            p.cancel();

            for (let x of innerPromises)
                x.cancel(); // What if this throws?
        });
    }));
}

function concat() {

    return new Observable((next, cleanup) => new Promise((resolve, reject) => {

        let innerPromise = Promise.resolve();

        let p = this.forEach(inner => {

            innerPromise = innerPromise.then(_=> inner.forEach(next).catch(reject));

        }, cancel).then(x => innerPromise.then(_=> resolve(x)), reject);

        cleanup(_=> {
            p.cancel();
            innerPromise.cancel();
        });
    }));
}

function exhaust() {

    return new Observable((next, cancel) => new Promise((resolve, reject) => {

        let innerPromise = Promise.resolve();

        let p = this.forEach(inner => {

            if (innerPromise)
                return;

            innerPromise = inner.forEach(next).then(_=> innerPromise = null, reject);

        }).then(x => innerPromise.then(_=> resolve(x)), reject);

        cleanup(_=> {
            p.cancel();
            innerPromise.cancel();
        });
    }));
}

function pairwise() {

    return new Observable((next) => {

        let none = {}, prev = none;

        return this.forEach(x => {

            if (prev !== none)
                next([prev, x]);

            prev = x;
        });
    });
}

function find(fn) {

    return new Observable((next, cleanup) => new Promise((resolve, reject) => {

        let p = this.forEach(x => {

            if (fn(x))
                resolve(x);

        }, cancel).then(x => resolve(), reject);

        cleanup(_=> p.cancel());

    }));
}

function findIndex(fn) {

    return new Observable((next, cleanup) => new Promise((resolve, reject) => {

        let i = -1;

        let p = this.forEach(x => {

            i++;

            if (fn(x))
                resolve(i);

        }).then(x => resolve(-1), reject);

        cleanup(_=> p.cancel());

    }));
}
