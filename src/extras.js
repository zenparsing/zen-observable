import { Observable } from './Observable.js';

// Emits all values from all inputs in parallel
export function merge(...sources) {
  if (sources.length === 0)
    return Observable.of();

  return new Observable(observer => {
    let count = sources.length;
    let cancels = [];

    observer.start(() => cancels.forEach(cancel => cancel()));

    sources.forEach(source => Observable.from(source).subscribe({
      start(c) {
        cancels.push(c);
      },
      next(v) {
        observer.next(v);
      },
      error(e) {
        observer.error(e);
      },
      complete() {
        if (--count === 0)
          observer.complete();
      },
    }));
  });
}

// Emits arrays containing the most current values from each input
export function combineLatest(...sources) {
  if (sources.length === 0)
    return Observable.of();

  return new Observable(observer => {
    let count = sources.length;
    let values = new Map();
    let cancels = [];

    observer.start(() => cancels.forEach(cancel => cancel()));

    sources.forEach((source, index) => Observable.from(source).subscribe({
      start(c) {
        cancels.push(c);
      },
      next(v) {
        values.set(index, v);
        if (values.size === sources.length)
          observer.next(Array.from(values.values()));
      },
      error(e) {
        observer.error(e);
      },
      complete() {
        if (--count === 0)
          observer.complete();
      },
    }));
  });
}

// Emits arrays containing the matching index values from each input
export function zip(...sources) {
  if (sources.length === 0)
    return Observable.of();

  return new Observable(observer => {
    let queues = sources.map(() => []);
    let cancels = [];

    function done() {
      return queues.some(q => q.length === 0 && q.complete);
    }

    observer.start(() => cancels.forEach(cancel => cancel()));

    sources.forEach((source, index) => {
      if (observer.closed)
        return;

      Observable.from(source).subscribe({
        start(c) {
          cancels.push(c);
          queues[index].complete = false;
        },
        next(v) {
          queues[index].push(v);
          if (queues.every(q => q.length > 0)) {
            observer.next(queues.map(q => q.shift()));
            if (done())
              observer.complete();
          }
        },
        error(e) {
          observer.error(e);
        },
        complete() {
          queues[index].complete = true;
          if (done())
            observer.complete();
        },
      });
    });
  });
}
