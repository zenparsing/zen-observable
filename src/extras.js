let Observable = require('./Observable');

// Emits all values from all inputs in parallel
const merge = (...sources) => new Observable(observer => {
  let count = sources.length;

  let subscriptions = sources.map(source => source.subscribe({
    next(v) { observer.next(v) },
    error(e) { observer.error(e) },
    complete() { if (--count === 0) observer.complete(); },
  }));

  return () => subscriptions.forEach(s => s.unsubscribe());
});

// Emits arrays containing the most current values from each input
const combineLatest = (...sources) => new Observable(observer => {
  let count = sources.length;
  let values = new Map();

  let subscriptions = sources.map((source, index) => source.subscribe({
    next(v) {
      values.set(index, v);
      if (values.size === sources.length)
        observer.next(Array.from(values.values()));
    },
    error(e) { observer.error(e) },
    complete() { if (--count === 0) observer.complete(); },
  }));

  return () => subscriptions.forEach(s => s.unsubscribe());
});

// Emits arrays containing the matching index values from each input
const zip = (...sources) => new Observable(observer => {
  let queues = sources.map(() => []);

  let subscriptions = sources.map((source, index) => source.subscribe({
    next(v) {
      queues[index].push(v);
      if (queues.every(q => q.length > 0))
        observer.next(queues.map(q => q.shift()));
    },
    error(e) { observer.error(e) },
    complete() { observer.complete() },
  }));

  return () => subscriptions.forEach(s => s.unsubscribe());
});

module.exports = { merge, combineLatest, zip };
