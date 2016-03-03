export default {

    "Observable.from" (test, { Observable }) {

        let list = [];

        return Observable.from([1, 2, 3]).flatMap(x => {
            return Observable.from([x * 1, x * 2, x * 3]);
        }).forEach(x => {
            list.push(x);
        }).then(x => {
            test.equals(list, [1, 2, 3, 2, 4, 6, 3, 6, 9]);
        });
    },

    "Error if return value is not observable" (test, { Observable }) {

        let list = [];

        return Observable.from([1, 2, 3]).flatMap(x => {
            return 1;
        }).forEach(x => null).then(
            x => test.assert(false),
            x => test.assert(true));
    },

};
