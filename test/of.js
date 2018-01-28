const Observable = require('../src/Observable');
const assert = require('assert');
const { testMethodProperty } = require('./properties');

describe('of', () => {
  it('is a method on Observable', () => {
    testMethodProperty(Observable, 'of', {
      configurable: true,
      writable: true,
      length: 0,
    });
  });

  it('uses the this value if it is a function', () => {

  });
});
