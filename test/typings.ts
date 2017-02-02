import * as Observable from '..'

/**
 * Observable
 */

new Observable<number>(observer => {
  [1, 2, 3].forEach(one => observer.next(one))
  observer.complete()
})
  .subscribe(val => console.assert(typeof val === 'number'))

/**
 * Observable.of
 */

Observable.of(1, 2, 3)
  .subscribe(val => console.assert(typeof val === 'number'))

/**
 * Observable.from
 */

Observable.from(Observable.of(1, 2, 3))
  .subscribe(val => console.assert(typeof val === 'number'))

Observable.from([1, 2, 3])
  .subscribe(val => console.assert(typeof val === 'number'))

Observable.from({
  subscribe(observer: ZenObservable.SubscriptionObserver<number>) {
    [1, 2, 3].forEach(one => observer.next(one))
    observer.complete()
  },
  [Symbol.observable]() {
    return this
  }
})
  .subscribe(val => console.assert(typeof val === 'number'))

Observable.from({
  [Symbol.observable]() {
    return Observable.of(1, 2, 3)
  }
})
  .subscribe(val => console.assert(typeof val === 'number'))

/**
 * observable.forEach
 */

Observable.of(1, 2, 3)
  .forEach(val => console.assert(typeof val === 'number'))

/**
 * observable.map
 */

Observable.of(1, 2, 3)
  .map(val => val.toString())
  .subscribe(val => console.assert(typeof val === 'string'))

/**
 * observable.filter
 */

Observable.of(1, 2, 3)
  .filter(val => val !== 2)
  .subscribe(val => console.assert(typeof val === 'number' && val !== 2))

/**
 * observable.reduce
 */

Observable.of(1, 2, 3)
  .reduce((acc, val) => acc + val)
  .subscribe(val => console.assert(val === 6))

Observable.of(1, 2, 3)
  .reduce((acc, val) => acc + val, '')
  .subscribe(val => console.assert(val === '123'))

/**
 * observable.flatMap
 */

Observable.of(1, 2, 3)
  .flatMap(val => Observable.of(val.toString()))
  .subscribe(val => console.assert(typeof val === 'string'))
