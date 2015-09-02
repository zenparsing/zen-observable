var spawn = require("child_process").spawn;

spawn("esdown",
    ["-", "../src/Observable.js", "../zen-observable.js", "-g", "*"],
    { stdio: "inherit", env: process.env, cwd: __dirname }
);
