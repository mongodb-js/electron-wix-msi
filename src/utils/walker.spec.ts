import assert from 'assert';
import * as path from 'path';

import { getDirectoryStructure } from './walker';
import { expect } from 'chai';

describe('getDirectoryStructure()', function () {
  it('actually returns files and folders', async function () {
    const fixturePath = path.join(
      __dirname,
      '../../__tests__/fixture/walkable',
    );
    const { files, directories } = await getDirectoryStructure(fixturePath);

    const expectedFiles = [
      path.join(fixturePath, 'testfile'),
      path.join(fixturePath, '@hithere', 'deeper', 'another-file.txt'),
    ];

    const expectedDirectories = [
      path.join(fixturePath, '@hithere'),
      path.join(fixturePath, '@hithere', 'deeper'),
    ];

    expect(files).to.deep.equal(expectedFiles);
    expect(directories).to.deep.equal(expectedDirectories);
  });

  it('throws if the folder does not exist', async function () {
    await assert.rejects(getDirectoryStructure('nope'), {
      message: 'App directory nope does not exist',
    });
  });
});
