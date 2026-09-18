import { expect } from 'chai';
import sinon from 'sinon';

import { MockSpawn } from '../../__tests__/mocks/mock-spawn';
import childProcess from 'child_process';
import { spawnPromise } from './spawn';

describe('spawnPromise()', function () {
  before(function () {
    sinon
      .stub(childProcess, 'spawn')
      .callsFake(
        ((name: string, args: Array<string>, o: unknown, fs: unknown) =>
          new MockSpawn(
            name,
            args,
            o,
            fs,
          )) as unknown as typeof childProcess.spawn,
      );
  });

  after(function () {
    sinon.restore();
  });

  it('spawns a process and returns data on close', async function () {
    const { code, stderr, stdout } = await spawnPromise('hi', ['yup']);

    expect(code).to.equal(0);
    expect(stderr).to.equal('A bit of error');
    expect(stdout).to.equal('A bit of data');
  });
});
