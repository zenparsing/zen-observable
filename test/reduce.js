// TODO

Observable.from([0, 1, 2, 3]).reduce((a, b) => {
    return a + b;
}).forEach(x => {
    console.log(x);
})
