import { Observable } from '../src/Observable.js';

beforeEach(() => {
  global.Observable = Observable;
  global.hostError = null;
  let $extensions = Object.getOwnPropertySymbols(Observable)[1];
  let { hostReportError, symbol } = Observable[$extensions];
  hostReportError.log = (e => global.hostError = e);
  global.observableSymbol = symbol;
});
