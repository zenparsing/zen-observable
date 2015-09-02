## zen-observable

An implementation of [ES Observables](https://github.com/zenparsing/es-observable).

Requires ES6 Promises or a Promise polyfill.

### Install

```
npm install zen-observable
```

### Download

- [zen-observable.js](https://raw.githubusercontent.com/zenparsing/zen-observable/master/zen-observable.js)

### Usage

Node:

```js
var Observable = require("zen-observable");

Observable.of(1, 2, 3).forEach(x => console.log(x));
```

Browser:

```html
<script src="zen-observable.js"></script>
<script>
    Observable.of(1, 2, 3).forEach(x => console.log(x));
</script>
```
