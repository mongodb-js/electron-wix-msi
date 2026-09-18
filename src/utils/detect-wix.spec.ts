import { expect } from 'chai';
import sinon from 'sinon';

import childProcess from 'child_process';
import { hasBinary, hasCandle, hasLight } from './detect-wix';

describe('detect-wix', function () {
  before(function () {
    sinon.stub(childProcess, 'execSync').callsFake(((name: string) => {
      if (name === 'node -v') {
        return '8.0.0';
      }

      if (name === 'light -?' || name === 'candle -?') {
        return ' version 3.11.0.1701';
      }

      throw new Error('Command not found');
    }) as typeof childProcess.execSync);
  });

  after(function () {
    sinon.restore();
  });

  describe('hasBinary()', function () {
    it('returns true for "node -v"', function () {
      expect(hasBinary('node -v')).to.deep.equal({ has: true, version: null });
    });

    it('returns false for "there-is-no-way-i-exist"', function () {
      expect(hasBinary('there-is-no-way-i-exist')).to.deep.equal({
        has: false,
        version: null,
      });
    });
  });

  describe('hasCandle()', function () {
    it('returns true and correct version', function () {
      expect(hasCandle()).to.deep.equal({ has: true, version: '3.11.0.1701' });
    });
  });

  describe('hasLight()', function () {
    it('returns true and correct version', function () {
      expect(hasLight()).to.deep.equal({ has: true, version: '3.11.0.1701' });
    });
  });
});
