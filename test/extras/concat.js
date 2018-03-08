import assert from 'assert';
import { parse } from './parse.js';
import { concat } from '../../src/extras.js';

describe('extras/concat', () => {
  it('concatenates the supplied Observable arguments', async () => {
    let output = '';
    await concat(
      parse('a-b-c-d'),
      parse('-A-B-C-D')
    ).forEach(
      value => output += value
    );
    assert.equal(output, 'abcdABCD');
  });
});
