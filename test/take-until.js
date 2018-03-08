import assert from 'assert';
import { parse } from './parse.js';

describe('takeUntil', () => {
  it('takes values until the supplied signal is observed', async () => {
    let output = '';
    await parse('a-b-c-d').takeUntil(
      parse('---x')
    ).forEach(
      value => output += value
    );
    assert.equal(output, 'ab');
  });

  it('takes values until the supplied signal is complete', async () => {
    let output = '';
    await parse('a-b-c-d').takeUntil(
      parse('-')
    ).forEach(
      value => output += value
    );
    assert.equal(output, 'a');
  });
});
