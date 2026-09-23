import assert from 'assert';
import type { SpawnOptions } from 'child_process';
import { expect } from 'chai';
import * as fs from 'fs-extra';
import mockFs from 'mock-fs';
import * as os from 'os';
import * as path from 'path';
import sinon from 'sinon';

import type { UIOptions } from './creator';
import { MSICreator } from './creator';
import {
  getMockFileSystem,
  numberOfFiles,
  root,
} from '../__tests__/mocks/mock-fs';
import { MockSpawn } from '../__tests__/mocks/mock-spawn';
import childProcess from 'child_process';

const mockPassedFs = fs;
const mockSpawnArgs: {
  name: string;
  args: Array<string>;
  options: SpawnOptions;
} = {
  name: '',
  args: [],
  options: {},
};

const defaultOptions = {
  appDirectory: root,
  description: 'ACME is the best company ever',
  exe: 'acme',
  name: 'Acme',
  manufacturer: 'Acme Technologies',
  version: '1.0.0',
  outputDirectory: path.join(os.tmpdir(), 'electron-wix-msi-test'),
};

let mockWixInstalled = true;

describe('MSICreator', function () {
  before(function () {
    sinon.stub(childProcess, 'execSync').callsFake(((name: string) => {
      if (name === 'node -v') {
        return '8.0.0';
      }

      if (name === 'light -?' || (name === 'candle -?' && mockWixInstalled)) {
        return ' version 3.11.0.1701';
      }

      throw new Error('Command not found');
    }) as typeof childProcess.execSync);

    sinon.stub(childProcess, 'spawn').callsFake(((
      name: string,
      args: Array<string>,
      options: SpawnOptions,
    ) => {
      mockSpawnArgs.name = name;
      mockSpawnArgs.args = args;
      mockSpawnArgs.options = options;
      return new MockSpawn(name, args, options, mockPassedFs);
    }) as unknown as typeof childProcess.spawn);

    mockFs(getMockFileSystem());
  });

  after(function () {
    mockFs.restore();
    sinon.restore();
  });

  afterEach(function () {
    mockWixInstalled = true;
    mockSpawnArgs.name = '';
    mockSpawnArgs.args = [];
    mockSpawnArgs.options = {};
  });

  it('can be constructed without errors', function () {
    expect(new MSICreator(defaultOptions)).to.be.ok;
  });

  describe('create()', function () {
    it('creates a basic Wix file', async function () {
      const msiCreator = new MSICreator(defaultOptions);

      const { wxsFile } = await msiCreator.create();
      expect(wxsFile).to.be.ok;
    });

    it('creates a .wxs file with content', async function () {
      const msiCreator = new MSICreator(defaultOptions);
      const { wxsFile } = await msiCreator.create();
      const wxsContent = await fs.readFile(wxsFile, 'utf-8');
      expect(wxsContent.length).to.be.greaterThan(50);
    });

    it('includes all elements', async function () {
      const msiCreator = new MSICreator(defaultOptions);
      const { wxsFile } = await msiCreator.create();
      const wxsContent = await fs.readFile(wxsFile, 'utf-8');

      const singleLineWxContent = wxsContent.replace(/\s\s+/g, ' ');
      expect(
        singleLineWxContent.includes(
          '<Wix xmlns="http://schemas.microsoft.com/wix/2006/wi" xmlns:util="http://schemas.microsoft.com/wix/UtilExtension">',
        ),
      ).to.be.ok;
      expect(singleLineWxContent.includes('<Package')).to.be.ok;
      expect(
        singleLineWxContent.includes(
          '<Directory Id="APPLICATIONROOTDIRECTORY"',
        ),
      ).to.be.ok;
      expect(
        singleLineWxContent.includes(
          '<Directory Id="ApplicationProgramsFolder"',
        ),
      ).to.be.ok;
      expect(
        singleLineWxContent.includes(
          'Key="System.AppUserModel.ID" Value="com.squirrel.Acme.acme"',
        ),
      ).to.be.ok;
    });

    it('creates as many components as we have files', async function () {
      const msiCreator = new MSICreator(defaultOptions);
      const { wxsFile } = await msiCreator.create();
      const wxsContent = await fs.readFile(wxsFile, 'utf-8');
      // Files + Shortcut + InstallLocation
      const count = wxsContent.split('</Component>').length - 1;
      expect(count).to.deep.equal(numberOfFiles + 2);
    });

    it('creates a Wix file with UI properties', async function () {
      const ui: UIOptions = {
        images: {
          background: 'resources/background.bmp',
          banner: 'resources/banner.bmp',
          exclamationIcon: 'resources/exclamationIcon.bmp',
          infoIcon: 'resources/infoIcon.bmp',
          newIcon: 'resources/newIcon.bmp',
          upIcon: 'resources/upIcon.bmp',
        },
      };

      const msiCreator = new MSICreator({ ...defaultOptions, ui });

      const { wxsFile } = await msiCreator.create();
      const wxsContent = await fs.readFile(wxsFile, 'utf-8');
      expect(wxsFile).to.be.ok;

      expect(
        wxsContent.includes(
          'Id="WixUIDialogBmp" Value="resources/background.bmp" />',
        ),
      ).to.be.ok;
      expect(
        wxsContent.includes(
          'Id="WixUIBannerBmp" Value="resources/banner.bmp" />',
        ),
      ).to.be.ok;
      expect(
        wxsContent.includes(
          'Id="WixUIExclamationIco" Value="resources/exclamationIcon.bmp" />',
        ),
      ).to.be.ok;
      expect(
        wxsContent.includes(
          'Id="WixUIInfoIco" Value="resources/infoIcon.bmp" />',
        ),
      ).to.be.ok;
      expect(
        wxsContent.includes(
          'Id="WixUINewIco" Value="resources/newIcon.bmp" />',
        ),
      ).to.be.ok;
      expect(
        wxsContent.includes('Id="WixUIUpIco" Value="resources/upIcon.bmp" />'),
      ).to.be.ok;

      const comoponentCount = wxsContent.split('</Component>').length - 1;
      const refCount = wxsContent.split('<ComponentRef').length - 1;

      expect(comoponentCount).to.deep.equal(refCount);
    });

    it('does not throw if properties are weird', async function () {
      const ui: any = {
        images: {
          nope: 'resources/background.bmp',
        },
      };

      const msiCreator = new MSICreator({ ...defaultOptions, ui });

      const { wxsFile } = await msiCreator.create();
      expect(wxsFile).to.be.ok;
    });

    it('does not throw if UI is just true', async function () {
      const msiCreator = new MSICreator({ ...defaultOptions, ui: true });

      const { wxsFile } = await msiCreator.create();
      expect(wxsFile).to.be.ok;
    });

    it('does not throw if UI is just false', async function () {
      const msiCreator = new MSICreator({ ...defaultOptions, ui: true });

      const { wxsFile } = await msiCreator.create();
      expect(wxsFile).to.be.ok;
    });

    it('does not throw if UI is just an object', async function () {
      const msiCreator = new MSICreator({
        ...defaultOptions,
        ui: { chooseDirectory: true },
      });

      const { wxsFile } = await msiCreator.create();
      expect(wxsFile).to.be.ok;
    });

    it('does not restrict install directory permissions by default', async function () {
      const msiCreator = new MSICreator(defaultOptions);
      const { wxsFile } = await msiCreator.create();
      const wxsContent = await fs.readFile(wxsFile, 'utf-8');

      expect(wxsContent).to.not.include('<Permission ');
      expect(wxsContent).to.not.include('ApplicationRootDirectoryPermissions');

      // Files + Shortcut + InstallLocation
      const count = wxsContent.split('</Component>').length - 1;
      expect(count).to.deep.equal(numberOfFiles + 2);
    });

    it('restricts install directory permissions when enabled', async function () {
      const msiCreator = new MSICreator({
        ...defaultOptions,
        restrictInstallDirPermissions: true,
      });
      const { wxsFile } = await msiCreator.create();
      const wxsContent = await fs.readFile(wxsFile, 'utf-8');
      const singleLineWxContent = wxsContent.replace(/\s\s+/g, ' ');

      expect(singleLineWxContent).to.include(
        '<Permission User="Administrators" GenericAll="yes"/>',
      );
      expect(singleLineWxContent).to.include(
        '<Permission User="SYSTEM" GenericAll="yes"/>',
      );
      expect(singleLineWxContent).to.include(
        '<Permission User="Everyone" GenericRead="yes" GenericExecute="yes"/>',
      );

      // The component is only installed if the feature references it
      expect(wxsContent).to.include(
        '<ComponentRef Id="ApplicationRootDirectoryPermissions" />',
      );

      // Files + Shortcut + InstallLocation + Permissions
      const count = wxsContent.split('</Component>').length - 1;
      const refCount = wxsContent.split('<ComponentRef').length - 1;
      expect(count).to.deep.equal(numberOfFiles + 3);
      expect(count).to.deep.equal(refCount);
    });

    it('sets the appUserModelId', async function () {
      const msiCreator = new MSICreator({
        ...defaultOptions,
        appUserModelId: 'Hi',
      });

      const { wxsFile } = await msiCreator.create();
      expect(wxsFile).to.be.ok;
      const wxsContent = await fs.readFile(wxsFile, 'utf-8');
      expect(wxsContent.includes(`Key="System.AppUserModel.ID" Value="Hi"`)).to
        .be.ok;
    });
  });

  describe('compile()', function () {
    it('throws if candle/light are not installed', async function () {
      mockWixInstalled = false;
      const msiCreator = new MSICreator(defaultOptions);
      await assert.rejects(msiCreator.compile(), {
        message: 'Could not find light.exe or candle.exe',
      });
    });

    it('throws if there is no wxsFile', async function () {
      const msiCreator = new MSICreator(defaultOptions);
      await assert.rejects(msiCreator.compile(), {
        message: 'wxsFile not found. Did you run create() yet?',
      });
    });

    it('creates a wixobj and msi file', async function () {
      const msiCreator = new MSICreator({ ...defaultOptions, ui: false });
      await msiCreator.create();

      const { wixobjFile, msiFile } = await msiCreator.compile();

      expect(wixobjFile).to.be.ok;
      expect(fs.existsSync(wixobjFile)).to.be.ok;

      expect(msiFile).to.be.ok;
      expect(fs.existsSync(msiFile)).to.be.ok;
    });

    it('creates a wixobj and msi file with ui extensions', async function () {
      const msiCreator = new MSICreator({ ...defaultOptions, ui: true });

      await msiCreator.create();
      await msiCreator.compile();

      expect(mockSpawnArgs.args).to.include('WixUIExtension');
    });

    it('passes extension args to the binary', async function () {
      const extensions = ['WixUIExtension', 'WixUtilExtension'];
      const msiCreator = new MSICreator({ ...defaultOptions, extensions });

      await msiCreator.create();
      await msiCreator.compile();

      expect(mockSpawnArgs.args).to.include.members(extensions);
    });

    it('combines custom extensions with ui extensions', async function () {
      const extensions = ['WixNetFxExtension', 'WixUtilExtension'];
      const msiCreator = new MSICreator({
        ...defaultOptions,
        extensions,
        ui: true,
      });

      await msiCreator.create();
      await msiCreator.compile();

      expect(mockSpawnArgs.args).to.include('WixUIExtension');
      expect(mockSpawnArgs.args).to.include.members(extensions);
    });

    it('throws if candle or light fail', async function () {
      const msiCreator = new MSICreator({
        ...defaultOptions,
        exe: 'fail-code-candle',
      });
      const err = 'A bit of error';
      const out = 'A bit of data';
      const expectedErr = new Error(
        `Could not create wixobj file. Code: 1 StdErr: ${err} StdOut: ${out}`,
      );

      await msiCreator.create();
      await assert.rejects(msiCreator.compile(), {
        message: expectedErr.message,
      });
    });

    it('throws if candle does not create a file', async function () {
      const msiCreator = new MSICreator({
        ...defaultOptions,
        exe: 'fail-candle',
      });
      const err = 'A bit of error';
      const out = 'A bit of data';
      const expectedErr = new Error(
        `Could not create wixobj file. Code: 0 StdErr: ${err} StdOut: ${out}`,
      );

      await msiCreator.create();
      await assert.rejects(msiCreator.compile(), {
        message: expectedErr.message,
      });
    });

    it('throws if light does not create a file', async function () {
      const msiCreator = new MSICreator({
        ...defaultOptions,
        exe: 'fail-light',
      });
      const err = 'A bit of error';
      const out = 'A bit of data';
      const expectedErr = new Error(
        `Could not create msi file. Code: 0 StdErr: ${err} StdOut: ${out}`,
      );

      await msiCreator.create();
      await assert.rejects(msiCreator.compile(), {
        message: expectedErr.message,
      });
    });

    it('tries to sign the MSI with default options', async function () {
      const certOptions = {
        certificateFile: 'path/to/file',
        certificatePassword: 'hi',
      };
      const msiCreator = new MSICreator({ ...defaultOptions, ...certOptions });

      await msiCreator.create();
      await msiCreator.compile();

      const expectedCert = path.join(process.cwd(), 'path/to/file');
      const expectedMsi = path.join(defaultOptions.outputDirectory, 'acme.msi');
      const expectedArgs = [
        'sign',
        '/a',
        '/f',
        `${expectedCert}`,
        '/p',
        'hi',
        `${expectedMsi}`,
      ];

      expect(mockSpawnArgs.name.endsWith('signtool.exe')).to.be.ok;
      expect(mockSpawnArgs.args).to.deep.equal(expectedArgs);
    });

    it('tries to sign the MSI with custom options', async function () {
      const certOptions = {
        certificateFile: 'path/to/file',
        signWithParams: 'hello "how are you"',
      };
      const msiCreator = new MSICreator({ ...defaultOptions, ...certOptions });

      await msiCreator.create();
      await msiCreator.compile();

      const expectedMsi = path.join(defaultOptions.outputDirectory, 'acme.msi');
      const expectedArgs = ['sign', 'hello', '"how are you"', expectedMsi];

      expect(mockSpawnArgs.name.endsWith('signtool.exe')).to.be.ok;
      expect(mockSpawnArgs.args).to.deep.equal(expectedArgs);
    });

    it('throws if certificateFile is set without certificatePassword', async function () {
      const certOptions = { certificateFile: 'hello "how are you"' };
      const msiCreator = new MSICreator({
        ...defaultOptions,
        exe: 'fail-code-signtool',
        ...certOptions,
      });
      const expectedErr = new Error(
        'You must provide a certificatePassword with a certificateFile',
      );

      await msiCreator.create();
      await assert.rejects(msiCreator.compile(), {
        message: expectedErr.message,
      });
    });

    it('throws if signing throws', async function () {
      const certOptions = {
        certificateFile: 'path/to/file',
        signWithParams: 'hello "how are you"',
      };
      const msiCreator = new MSICreator({
        ...defaultOptions,
        exe: 'fail-code-signtool',
        ...certOptions,
      });
      const expectedErr = new Error(
        `Signtool exited with code 1. Stderr: A bit of error. Stdout: A bit of data`,
      );

      await msiCreator.create();
      await assert.rejects(msiCreator.compile(), {
        message: expectedErr.message,
      });
    });
  });

  describe('create() architecture', function () {
    describe('x86 by default', function () {
      it('creates the file', async function () {
        const msiCreator = new MSICreator({ ...defaultOptions });

        const { wxsFile } = await msiCreator.create();
        const wxsContent = await fs.readFile(wxsFile, 'utf-8');
        expect(wxsFile).to.be.ok;

        expect(wxsContent).to.include('Platform="x86"');
        expect(wxsContent).to.include('Win64="no"');
        expect(wxsContent).to.include('ProcessorArchitecture="x86"');
      });
    });

    describe('x86 explicitly', function () {
      it('creates the file', async function () {
        const msiCreator = new MSICreator({ ...defaultOptions, arch: 'x86' });

        const { wxsFile } = await msiCreator.create();
        const wxsContent = await fs.readFile(wxsFile, 'utf-8');
        expect(wxsFile).to.be.ok;

        expect(wxsContent).to.include('Platform="x86"');
        expect(wxsContent).to.include('Win64="no"');
        expect(wxsContent).to.include('ProcessorArchitecture="x86"');
      });
    });

    describe('x64', function () {
      it('creates the file', async function () {
        const msiCreator = new MSICreator({ ...defaultOptions, arch: 'x64' });

        const { wxsFile } = await msiCreator.create();
        const wxsContent = await fs.readFile(wxsFile, 'utf-8');
        expect(wxsFile).to.be.ok;

        expect(wxsContent).to.include('Platform="x64"');
        expect(wxsContent).to.include('Win64="yes"');
        expect(wxsContent).to.include('ProcessorArchitecture="x64"');
      });
    });

    describe('ia64', function () {
      it('creates the file', async function () {
        const msiCreator = new MSICreator({ ...defaultOptions, arch: 'ia64' });

        const { wxsFile } = await msiCreator.create();
        const wxsContent = await fs.readFile(wxsFile, 'utf-8');
        expect(wxsFile).to.be.ok;

        expect(wxsContent).to.include('Platform="ia64"');
        expect(wxsContent).to.include('Win64="yes"');
        expect(wxsContent).to.include('ProcessorArchitecture="ia64"');
      });
    });
  });

  describe('create() with a shortcutName', function () {
    it('creates the file', async function () {
      const msiCreator = new MSICreator({
        ...defaultOptions,
        shortcutName: 'BeepBeep',
      });

      const { wxsFile } = await msiCreator.create();
      const wxsContent = await fs.readFile(wxsFile, 'utf-8');
      expect(wxsFile).to.be.ok;
      const singleLineWxContent = wxsContent.replace(/\s\s+/g, ' ');
      expect(singleLineWxContent).to.include(
        '<Shortcut Id="ApplicationStartMenuShortcut" Name="BeepBeep"',
      );
    });
  });
});
