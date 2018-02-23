# zen-observable

An implementation of Observables for Javascript. Requires Promises or a Promise polyfill.

## Install

```sh
npm install zen-observable
```

## Usage

```js
import Observable from 'zen-observable';

Observable.of(1, 2, 3).forEach(x => console.log(x));
```

## API

### new Observable(subscriber)

```js
let observable = new Observable(observer => {
  // Emit a single value after 1 second
  const timer = setTimeout(() => {
    observer.next('hello');
    observer.complete();
  }, 1000);

  // On unsubscription, cancel the timer
  observer.start(() => clearTimeout(timer));
});
```

Creates a new Observable object using the specified subscriber function.  The subscriber function is called whenever the `subscribe` method of the observable object is invoked.  The subscriber function is passed an *observer* object which has the following methods:

- `start(cleanup)` Starts the subscription and registers a cleanup function.
- `next(value)` Sends the next value in the sequence.
- `error(exception)` Terminates the sequence with an exception.
- `complete()` Terminates the sequence successfully.
- `closed` A boolean property whose value is `true` if the observer's subscription is closed.

### Observable.of(...items)

```js
// Logs 1, 2, 3
Observable.of(1, 2, 3).subscribe(x => {
  console.log(x);
});
```

Returns an observable which will emit each supplied argument.

### Observable.from(value)

```js
let list = [1, 2, 3];

// Iterate over an object
Observable.from(list).subscribe(x => {
  console.log(x);
});
```

```js
// Convert something 'observable' to an Observable instance
Observable.from(otherObservable).subscribe(x => {
  console.log(x);
});
```

Converts `value` to an Observable.

- If `value` is an implementation of Observable, then it is converted to an instance of Observable as defined by this library.
- Otherwise, it is converted to an Observable which synchronously iterates over `value`.

### observable.subscribe([observer])

```js
observable.subscribe({
  start(cancel) { console.log('Subscription initialized') },
  next(x) { console.log(x) },
  error(err) { console.log(`Finished with error: ${ err }`) },
  complete() { console.log('Finished') }
});
```

Subscribes to the observable.  Observer objects may have any of the following methods:

- `start(cancel)` Receives the cancellation function during subscription initialization.
- `next(value)` Receives the next value of the sequence.
- `error(exception)` Receives the terminating error of the sequence.
- `complete()` Called when the stream has completed successfully.

### observable.forEach(callback)

```js
observable.forEach(x => {
  console.log(`Received value: ${ x }`);
}).then(() => {
  console.log('Finished successfully')
}).catch(err => {
  console.log(`Finished with error: ${ err }`);
})
```

Subscribes to the observable and returns a Promise for the completion value of the stream.  The `callback` argument is called once for each value in the stream.

### observable.filter(callback)

```js
Observable.of(1, 2, 3).filter(value => {
  return value > 2;
}).forEach(value => {
  console.log(value);
});
// 3
```

Returns a new Observable that emits all values which pass the test implemented by the `callback` argument.

### observable.map(callback)

Returns a new Observable that emits the results of calling the `callback` argument for every value in the stream.

```js
Observable.of(1, 2, 3).map(value => {
  return value * 2;
}).forEach(value => {
  console.log(value);
});
// 2
// 4
// 6
```

### observable.reduce(callback [,initialValue])

```js
Observable.of(0, 1, 2, 3, 4).reduce((previousValue, currentValue) => {
  return previousValue + currentValue;
}).forEach(result => {
  console.log(result);
});
// 10
```

Returns a new Observable that applies a function against an accumulator and each value of the stream to reduce it to a single value.

### observable.concat(...sources)

```js
Observable.of(1, 2, 3).concat(
  Observable.of(4, 5, 6),
  Observable.of(7, 8, 9)
).forEach(result => {
  console.log(result);
});
// 1, 2, 3, 4, 5, 6, 7, 8, 9
```

Merges the current observable with additional observables.
