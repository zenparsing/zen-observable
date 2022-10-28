import assert from 'assert';

describe('all', ()=> {
  it('should receive all the observed values in order as an array', async () => {
    let observable = Observable.of(1,2,3,4);
    let values = await observable.all();

    assert.deepEqual(values, [1,2,3,4]);
  });
});
