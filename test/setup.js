import { Observable } from '../src/index.js';

beforeEach(() => {
  global.Observable = Observable;
  global.hostError = null;
  let $extensions = Object.getOwnPropertySymbols(Observable)[1];
  let { hostReportError } = Observable[$extensions];
  hostReportError.log = (e => global.hostError = e);
});
