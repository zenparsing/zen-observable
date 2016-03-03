import { runTests } from "es-observable-tests";
import { Observable } from "../src/Observable.js";
import { TestRunner } from "moon-unit";

import flatMapTests from "./flatMap.js";
import reduceTests from "./reduce.js";

runTests(Observable).then(_=> {

    return new TestRunner().inject({ Observable }).run({
        "flatMap": flatMapTests,
        "reduce": reduceTests,
    });
});
