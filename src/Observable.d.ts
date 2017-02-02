declare global {
  interface SymbolConstructor {
    observable: symbol
  }
}

declare global {

  namespace ZenObservable {

    interface SubscriptionObserver<T> {
      closed: boolean
      next(value: T): void
      error(errorValue: any): void
      complete(): void
    }

    interface Subscription {
      closed: boolean
      unsubscribe(): void
    }

    interface Observer<T> {
      start?(subscription: Subscription)
      next?(value: T): void
      error?(errorValue: any): void
      complete?(): void
    }

    interface Subscriber<T> {
      (observer: SubscriptionObserver<T>): void | Function | Subscription
    }

    interface ObservableLike<T> {
      subscribe?: Subscriber<T>
      [Symbol.observable](): Observable<T> | ObservableLike<T>
    }
  }
}

declare class Observable<T> {
  constructor(subscriber: ZenObservable.Subscriber<T>)
  subscribe(observer: ZenObservable.Observer<T>): ZenObservable.Subscription
  subscribe(onNext: (value: T) => void, onError?: (error: any) => void, onComplete?: () => void): ZenObservable.Subscription
  [Symbol.observable](): Observable<T>
}

declare namespace Observable {
  function from<T>(observable: Observable<T> | ZenObservable.ObservableLike<T> | ArrayLike<T>): Observable<T>
  function of<T>(...items: T[]): Observable<T>
}

interface Observable<T> {
  forEach(callback: (value: T) => void): Promise<void>
  map<R>(callback: (value: T) => R): Observable<R>
  filter(callback: (value: T) => boolean): Observable<T>
  reduce(callback: (previousValue: T, currentValue: T) => T, initialValue?: T): Observable<T>
  reduce<R>(callback: (previousValue: R, currentValue: T) => R, initialValue?: R): Observable<R>
  flatMap<R>(callback: (value: T) => ZenObservable.ObservableLike<R>): Observable<R>
}

export = Observable
