import { runTests } from "es-observable-tests";
import { Observable } from "../src/Observable.js";
import { TestRunner } from "moon-unit";

import flatMapTests from "./flatMap.js";
import reduceTests from "./reduce.js";
import mapTests from "./map.js";
import filterTests from "./filter.js";
import speciesTests from "./species.js";

runTests(Observable).then(() => {
  return new TestRunner().inject({ Observable }).run({
    "map": mapTests,
    "flatMap": flatMapTests,
    "reduce": reduceTests,
    "filter": filterTests,
    "species": speciesTests,
  });
});
