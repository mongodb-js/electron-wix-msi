import * as fs from 'fs-extra';
import * as path from 'path';

import { replaceInString, replaceToFile } from './replace';
import { expect } from 'chai';

describe('replace', function () {
  describe('replaceInString()', function () {
    it('actually replaces in a string', function () {
      const input = '{{Test}} {{Test2}} {{Test}}';
      const replacements = {
        '{{Test}}': 'Water',
        '{{Test2}}': 'Fire',
      };
      const expected = 'Water Fire Water';

      expect(replaceInString(input, replacements)).to.deep.equal(expected);
    });
  });

  describe('replaceToFile()', function () {
    it('actually replaces and writes to file', async function () {
      const input = '{{Test}} {{Test2}} {{Test}}';
      const replacements = {
        '{{Test}}': 'Water',
        '{{Test2}}': 'Fire',
      };
      const expected = 'Water Fire Water';
      const testFile = path.join(__dirname, '__testfile');

      await replaceToFile(input, testFile, replacements);

      expect(await fs.readFile(testFile, 'utf-8')).to.deep.equal(expected);
      await fs.unlink(testFile);
    });
  });
});
