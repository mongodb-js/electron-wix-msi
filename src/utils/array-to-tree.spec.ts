import { cloneDeep, defaultsDeep } from 'lodash';
import {
  addFilesToTree,
  arrayToTree,
  isChild,
  isDirectChild,
} from './array-to-tree';
import { separator as S } from './separator';
import { expect } from 'chai';

const mockFolders = [
  `slack${S}resources`,
  `slack${S}resources${S}app.asar.unpacked`,
  `slack${S}resources${S}app.asar.unpacked${S}node_modules`,
  `slack${S}resources${S}app.asar.unpacked${S}src`,
  `slack${S}locales`,
];

const mockFiles = [
  `slack${S}slack.exe`,
  `slack${S}resources${S}text.txt`,
  `slack${S}resources${S}app.asar.unpacked${S}image.png`,
  `slack${S}resources${S}app.asar.unpacked${S}node_modules${S}package.json`,
  `slack${S}resources${S}app.asar.unpacked${S}src${S}package.json`,
  `slack${S}locales${S}de-DE.json`,
  `slack${S}locales${S}en-US.json`,
];

const mockFolderTree = {
  __ELECTRON_WIX_MSI_PATH__: `slack`,
  __ELECTRON_WIX_MSI_FILES__: [],
  resources: {
    __ELECTRON_WIX_MSI_PATH__: `slack${S}resources`,
    __ELECTRON_WIX_MSI_FILES__: [],
    'app.asar.unpacked': {
      __ELECTRON_WIX_MSI_PATH__: `slack${S}resources${S}app.asar.unpacked`,
      __ELECTRON_WIX_MSI_FILES__: [],
      node_modules: {
        __ELECTRON_WIX_MSI_PATH__: `slack${S}resources${S}app.asar.unpacked${S}node_modules`,
        __ELECTRON_WIX_MSI_FILES__: [],
      },
      src: {
        __ELECTRON_WIX_MSI_PATH__: `slack${S}resources${S}app.asar.unpacked${S}src`,
        __ELECTRON_WIX_MSI_FILES__: [],
      },
    },
  },
  locales: {
    __ELECTRON_WIX_MSI_PATH__: `slack${S}locales`,
    __ELECTRON_WIX_MSI_FILES__: [],
  },
};

const mockFolderFileTree = defaultsDeep(cloneDeep(mockFolderTree), {
  __ELECTRON_WIX_MSI_FILES__: [
    { name: `slack.exe`, path: `slack${S}slack.exe` },
  ],
  resources: {
    __ELECTRON_WIX_MSI_FILES__: [
      { name: `text.txt`, path: `slack${S}resources${S}text.txt` },
    ],
    'app.asar.unpacked': {
      __ELECTRON_WIX_MSI_FILES__: [
        {
          name: `image.png`,
          path: `slack${S}resources${S}app.asar.unpacked${S}image.png`,
        },
      ],
      node_modules: {
        __ELECTRON_WIX_MSI_FILES__: [
          {
            name: `package.json`,
            path: `slack${S}resources${S}app.asar.unpacked${S}node_modules${S}package.json`,
          },
        ],
      },
      src: {
        __ELECTRON_WIX_MSI_FILES__: [
          {
            name: `package.json`,
            path: `slack${S}resources${S}app.asar.unpacked${S}src${S}package.json`,
          },
        ],
      },
    },
  },
  locales: {
    __ELECTRON_WIX_MSI_FILES__: [
      { name: `de-DE.json`, path: `slack${S}locales${S}de-DE.json` },
      { name: `en-US.json`, path: `slack${S}locales${S}en-US.json` },
    ],
  },
});

describe('array-to-tree', function () {
  describe('isChild()', function () {
    it('returns true for a child and parent', function () {
      const a = `C:${S}my${S}path`;
      const b = `C:${S}my${S}path${S}child`;

      expect(isChild(a, b)).to.be.ok;
    });

    it('returns false for a child and non-parent', function () {
      const a = `C:${S}my${S}path`;
      const b = `C:${S}my${S}other${S}path${S}child`;

      expect(isChild(a, b)).to.not.be.ok;
    });
  });

  describe('isDirectChild()', function () {
    it('returns true for a child and direct parent', function () {
      const a = `C:${S}my${S}path`;
      const b = `C:${S}my${S}path${S}child`;

      expect(isDirectChild(a, b)).to.be.ok;
    });

    it('returns false for a child and non-direct parent', function () {
      const a = `C:${S}my${S}path`;
      const b = `C:${S}my${S}path${S}child${S}ren`;

      expect(isDirectChild(a, b)).to.not.be.ok;
    });

    it('returns false for a child and non-parent', function () {
      const a = `C:${S}my${S}path`;
      const b = `C:${S}my${S}other${S}path${S}child`;

      expect(isDirectChild(a, b)).to.not.be.ok;
    });
  });

  describe('arrayToTree()', function () {
    it('creates a tree structure', function () {
      expect(arrayToTree(mockFolders, `slack`)).to.deep.equal(mockFolderTree);
    });
  });

  describe('addFilesToTree()', function () {
    it('adds files to a tree structure', function () {
      expect(addFilesToTree(mockFolderTree, mockFiles, `slack`)).to.deep.equal(
        mockFolderFileTree,
      );
    });
  });
});
