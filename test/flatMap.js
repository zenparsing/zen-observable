export default {

  "Observable.from" (test, { Observable }) {
    let list = [];

    return Observable.from([1, 2, 3]).flatMap(x => {
      return Observable.from([x * 1, x * 2, x * 3]);
    }).forEach(x => {
      list.push(x);
    }).then(() => {
      test.equals(list, [1, 2, 3, 2, 4, 6, 3, 6, 9]);
    });
  },

  "Error if return value is not observable" (test, { Observable }) {
    return Observable.from([1, 2, 3]).flatMap(() => {
      return 1;
    }).forEach(() => null).then(
      () => test.assert(false),
      () => test.assert(true));
  },

};
