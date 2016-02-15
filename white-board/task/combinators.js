function takeUntil(control) {

    return new Observable(next => new Promise((resolve, reject) => {
        this.forEach(next).then(resolve, reject);
        // TODO: Always resolve with undefined in this case?
        control.forEach(resolve).catch(reject);
    }));
}

function switch() {

    return new Observable(next => new Promise((resolve, reject) => {

        let innerTask, innerPromise;

        this.forEach(inner => {

            if (innerTask)
                innerTask.cancel();

            innerTask = new Task();
            innerPromise = innerTask.run(_=> inner.forEach(next)).catch(reject);

        }, cancel).then(x => innerPromise.then(_=> resolve(x)), reject);

    }));
}

function listen(eventName) {

    return new Observable(next => {

        this.addEventListener(eventName, next);
        function.cancelToken.whenRequested(_=> this.removeEventListener(eventName, next));
    });
}

function merge() {

    return new Observable(next => new Promise((resolve, reject) => {

        let innerPromises = [];

        this.forEach(inner => {

            // TODO: Probably want to remove from _innerPromises_ list after done
            innerPromises.push(inner.forEach(next).catch(reject));

        }, cancel).then(x => Promise.all(innerPromises).then(_=> resolve(x)), reject);
    }));
}

function concat() {

    return new Observable(next => new Promise((resolve, reject) => {

        let innerPromise = Promise.resolve();

        this.forEach(inner => {

            innerPromise = innerPromise.then(_=> inner.forEach(next).catch(reject));

        }, cancel).then(x => innerPromise.then(_=> resolve(x)), reject);
    }));
}

function exhaust() {

    return new Observable(next => new Promise((resolve, reject) => {

        let innerPromise = Promise.resolve();

        this.forEach(inner => {

            if (innerPromise)
                return;

            innerPromise = inner.forEach(next).then(_=> innerPromise = null, reject);

        }, cancel).then(x => innerPromise.then(_=> resolve(x)), reject);
    }));
}

function pairwise() {

    return new Observable(next => {

        let none = {}, prev = none;

        return this.forEach(x => {

            if (prev !== none)
                next([prev, x]);

            prev = x;

        });
    });
}

function find(fn) {

    return new Observable(next => new Promise((resolve, reject) => {

        this.forEach(x => {

            if (fn(x))
                resolve(x);

        }).then(x => resolve(), reject);

    }));
}

function findIndex(fn) {

    return new Observable(next => new Promise((resolve, reject) => {

        let i = -1;

        this.forEach(x => {

            i++;

            if (fn(x))
                resolve(i);

        }).then(x => resolve(-1), reject);

    }));
}
