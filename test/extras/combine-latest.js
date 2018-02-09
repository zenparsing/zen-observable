import assert from 'assert';
import { parse } from './parse.js';
import { combineLatest } from '../../src/extras.js';

describe('extras/combineLatest', () => {
  it('should emit arrays containing the most recent values', async () => {
    let output = [];
    await combineLatest(
      parse('a-b-c-d'),
      parse('-A-B-C-D')
    ).forEach(
      value => output.push(value.join(''))
    );
    assert.deepEqual(output, [
      'aA',
      'bA',
      'bB',
      'cB',
      'cC',
      'dC',
      'dD',
    ]);
  });
});
