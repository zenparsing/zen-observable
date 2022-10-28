import assert from 'assert';

describe('Symbol.asyncIterator', () => {

  it('should receive all the observed values in order', async () => {
    let observable = Observable.of(1, 2, 3, 4);
    let received = [];

    for await (let value of observable) {
      received.push(value);
    }

    assert.deepEqual(received, [1, 2, 3, 4]);
  });

  it('should throw if the observable errors', async () => {
    let observer;
    let observable = new Observable(x => { observer = x });
    let error = null;

    let promise = (async () => {
      try {
        for await (let value of observable) {}
      } catch (err) {
        error = err;
      }
    })();

    observer.error(new Error('bad'));
    await promise;

    assert.ok(error instanceof Error);
    assert.equal(error.message, 'bad');
  });

  it('should deliver values as they are produced', async () => {
    let observer;
    let observable = new Observable(x => { observer = x });
    let results = [];
    let sequence = [];

    let promise = (async () => {
      for await (let value of observable) {
        sequence.push(1);
        results.push(value);
      }
      sequence.push(2);
    })();

    observer.next(1);
    sequence.push(0);
    await new Promise(r => setTimeout(r, 100));
    observer.next(2);
    sequence.push(0);
    await new Promise(r => setTimeout(r, 100));
    observer.next(3);
    sequence.push(0);
    await new Promise(r => setTimeout(r, 100));
    observer.complete();
    sequence.push(0);

    await promise;

    assert.deepEqual(results, [1, 2, 3]);
    assert.deepEqual(sequence, [0, 1, 0, 1, 0, 1, 0, 2]);
  });

});
