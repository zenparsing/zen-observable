// TODO

Observable.from([0, 1, 2, 3]).flatMap(x => {
    return Observable.from("hello" + x);
}).forEach(x => {
    console.log(x);
})
