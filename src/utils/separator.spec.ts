import { expect } from 'chai';

const oldPlatform = process.platform;

// process.platform is readonly in @types/node, so it has to be redefined
// rather than assigned.
function setPlatform(platform: NodeJS.Platform) {
  Object.defineProperty(process, 'platform', {
    value: platform,
    configurable: true,
  });
}

describe('separator', function () {
  after(function () {
    setPlatform(oldPlatform);
  });

  // The module reads process.platform once at load, so the cache entry has to
  // be dropped for each case to pick up the patched value.
  function loadSeparator(platform: NodeJS.Platform): string {
    setPlatform(platform);
    delete require.cache[require.resolve('./separator')];
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('./separator').separator;
  }

  it('returns the correct separator for win32', function () {
    expect(loadSeparator('win32')).to.equal('\\');
  });

  it('returns the correct separator for unix', function () {
    expect(loadSeparator('linux')).to.equal('/');
  });
});
