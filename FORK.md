# About this fork

`@mongodb-js/electron-wix-msi` is a fork of
[`electron-wix-msi`](https://github.com/felixrieseberg/electron-wix-msi) (also
published from `electron-userland/electron-wix-msi`). It was forked in February
2019 at upstream **v2.1.1** (commit `7f2a003`) and has carried a small set of
Compass-specific patches ever since.

No pull requests, tickets, or review notes were attached to the original
changes, and the rationale was lost. This document reconstructs it from the git
history of this repo and of `mongodb-js/compass`, from the Jira record, and from
the source of the code that consumes the installers this package produces.

---

## 1. Why this fork exists

### 1.1 The original motivation, which no longer applies

Compass shipped Squirrel `.exe` installers. In September 2018,
[COMPASS-3117](https://jira.mongodb.org/browse/COMPASS-3117) ("Spike: Generate
an .msi with slack tooling") recorded the need for a real `.msi`: the MongoDB
Server Windows installer bundles Compass, and
[SERVER-35496](https://jira.mongodb.org/browse/SERVER-35496) was moving that
installer to a [WiX burn bundle](https://wixtoolset.org/documentation/manual/v3/bundle/),
which can only chain a genuine MSI. The ticket names
`felixrieseberg/electron-wix-msi`, then freshly released by Slack, as the
chosen tool, explicitly because it exposes the underlying WiX XML for
extension.

Compass adopted it in `f6300df4a4` (2019-01-29) and stopped `electron-winstaller`
from emitting its own MSI in `f81ea77b2c`.

**That motivation is now obsolete.** The Server installer no longer chains our
MSI. As of `mongodb/mongo` v8.0, `src/mongo/installer/msi/wxs/BinaryFragment.wxs`
runs `src/mongo/installer/compass/Install-Compass.ps1`, which downloads and
executes `compass-install.exe`, the Squirrel installer. It performs no MSI
chaining and reads no registry values from us.

### 1.2 Why a fork rather than a dependency

Upstream v2.1.1 had **no configuration surface** for what Compass needed. There
was no option to declare registry keys, no option to pass extra `light.exe`
switches, and the registry path was hardcoded to `Software\Microsoft\`. The only
way to change the generated WiX was to edit `static/wix.xml` in a copy of the
package. Forking was the sole mechanism available in 2019.

### 1.3 The reason the fork is still load-bearing today

The MongoDB Atlas CLI locates Compass through a registry key that **only this
fork produces**.

[`mongodb-atlas-cli/internal/compass/compass_bin_windows.go`](https://github.com/mongodb/mongodb-atlas-cli/blob/master/internal/compass/compass_bin_windows.go):

```go
// Location: HKEY_LOCAL_MACHINE\SOFTWARE\MongoDB\MongoDB Compass
// Key: Directory
key, err := registry.OpenKey(registry.LOCAL_MACHINE, `SOFTWARE\MongoDB\MongoDB Compass`, registry.QUERY_VALUE)
...
directory, _, err := key.GetStringValue("Directory")
```

That exact path is the product of fork changes **#1 and #2** below, given
Compass's `shortcutFolderName: "MongoDB"`
(`packages/compass/package.json`) and application short name `MongoDB Compass`.

Upstream 5.1.3 cannot produce it:

| | Upstream 5.1.3 | This fork |
| --- | --- | --- |
| Install path recorded at | `HKMU\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{ProductCode}.msq` → `InstallPath` | `HKLM\Software\MongoDB\MongoDB Compass` → `Directory` |
| Product key | `SOFTWARE\{{Manufacturer}}\{{ApplicationShortName}}`, holding only an `AutoUpdate` value, and only when the auto-updater feature is enabled | n/a |
| Arbitrary registry values from config | **not supported** — `MSICreatorOptions` has no `registry` field; the array is built by a private `getRegistryKeys()` (`src/creator.ts`) | n/a |

Note also that upstream keys off `Manufacturer`, which for Compass is
`"MongoDB Inc"`, not `"MongoDB"` — so even the product key would land at the
wrong path.

**Failure mode if the key is lost.** `binPath()` falls back to
`exec.LookPath("MongoDBCompass.exe")`, which searches `%PATH%` only. Neither
this fork nor upstream adds Compass to `PATH` — there is no `<Environment>`
element in either package's `static/*.xml`. Upstream writes an `App Paths`
entry (`static/file-association-header.xml`), but only when `associateExtensions`
is set, and Go's `LookPath` does not consult `App Paths`. So `binPath()` returns
`""`, `Detect()` returns `false`, and the Atlas CLI reports:

> `did not find MongoDB Compass, install: https://dochub.mongodb.org/core/install-compass`

on a machine where Compass is installed. This breakage is user-visible and
would not be caught by any test in the Compass repo; see [§3](#3-who-consumes-this-package) for the exact
coverage boundary.

(Incidentally, this key is written by the `.msi` only. Squirrel `.exe`
installations have never written it, so the Atlas CLI already fails to locate
Compass for users who installed via `.exe`.)

### 1.4 How the changes were made

Every functional change in this fork was written between **2019-02-08 and
2019-02-22**, in roughly twenty commits, each of which is a
`npm version` patch bump published to the registry:

```
3e00bcd Suppress validation on light.exe
ad81979 Adding registry key for installed directory
bc357c4 Update registry key
13c0521 Use local machine for registry
d3d40f0 Add registry key with other key
63cc2ad Only one key path per component
23588ea Set registry value in separate component
7aede47 Need to reference component
47c19c1 Guid not present
eeede76 Try registry value set directly
acd7176 Install key where previous was success
60dbb78 Back to writing 2 keys
8913860 Try giving component a guid
76965a5 Set Win64 on the hklm component
fd5b14f Remove orphaned folders on uninstall
0bd01ee Adding util ext to config
534009c Properties need to be all uppercase
35ef7cc Cannot have multiple key paths
2cb2c17 Remove extra backslash
```

This is a debugging loop against WiX's component and `KeyPath` rules, iterated
by publishing to npm and rebuilding Compass. There are no pull requests, no
Jira tickets, and no review on any of them.

**The commit messages record failed attempts, not design intent.** Reading them
as a description of the current behaviour will mislead; the diff in [§2](#2-what-this-fork-changes) is
authoritative.

---

## 2. What this fork changes

The complete delta against upstream v2.1.1 is seven files and roughly 117 lines
(`git diff 7f2a003..HEAD`), of which two files are `.gitignore` and a CodeQL
workflow. The functional changes:

| # | Change | Commits | Why it was made | In upstream 5.1.3? | Still required? |
| --- | --- | --- | --- | --- | --- |
| 1 | Registry root changed from `Software\Microsoft\{{ApplicationShortName}}` to `Software\{{ShortcutFolderName}}\{{ApplicationShortName}}` | `13c0521`, `534009c` | Compass's keys must live under `Software\MongoDB\`, not in Microsoft's hive | **No.** Still hardcoded to `Software\Microsoft\` (`static/wix.xml`) | **Yes.** Half of the path the Atlas CLI reads |
| 2 | New `ApplicationInstallLocation` component writing `HKLM\Software\{{ShortcutFolderName}}\{{ApplicationShortName}}` with values `Directory` and `UserDataDirectory` | `ad81979` → `2cb2c17` | expose the install path to external tools | **No.** Not expressible from config; `MSICreatorOptions` has no `registry` field | **`Directory`: yes** — read by the Atlas CLI. **`UserDataDirectory`: no** — no known consumer |
| 3 | `util:RemoveFolderEx` plus a `USERDATAFOLDER` `RegistrySearch`, deleting `[APPLICATIONROOTDIRECTORY]UserData` on uninstall | `fd5b14f`, `0bd01ee` | remove leftover user data on uninstall | Present, but bound to `INSTALLPATH` (the whole install directory) | **No.** Compass sets `userData` to `%APPDATA%\MongoDB Compass` (`packages/compass/src/setup-hadron-distribution.ts`); the targeted directory is never created |
| 4 | `-sval` passed unconditionally to `light.exe` for MSI output, suppressing ICE validation | `3e00bcd` | **not recorded.** Presumably ICE validation failures on the 2019 build agents | Available as the `lightSwitches?: string[]` option | Capability yes; hardcoding it is fork-specific |
| 5 | Two `console.log` calls in `src/creator.ts` (`'wxs content'`, `Executing ...`) | `3e00bcd` | debug leftovers, shipped unintentionally | No | **No** |
| 6 | Hardcoded component GUID `78B37883-AC76-44C6-8122-007BD077BA29` | `8913860` | WiX required an explicit GUID for the component added in #2 | n/a | Inherent to #2; noted as a wart |

Requirements this creates for callers: change #3 emits `util:` namespaced XML,
so the caller **must** pass `extensions: ['WixUtilExtension']` or `light.exe`
will fail.

**Changes that are not in this list.** Versions 2.2.0 and 2.2.1 were published
while the package lived in the Compass monorepo; the diff between 2.1.20 and the
extraction point touches only tests, CI configuration, and `package.json`. No
behavioural change.

---

## 3. Who consumes this package

### Compass

`packages/hadron-build/src/lib/target.ts` constructs the `MSICreator`. Options
this fork's behaviour depends on:

- `shortcutFolderName` — resolves to `"MongoDB"`, forming the registry path in changes #1 and #2.
- `extensions: ['WixUtilExtension']` — required by change #3.
- `chooseDirectory: true` — lets the installing administrator pick any install directory.

Nothing in Compass reads the registry values this fork writes. Compass's own
smoke tests read `InstallLocation` from the standard Windows Uninstall key
(`packages/compass-smoke-tests/src/installers/windows-setup.ts`), not from
`Software\MongoDB\MongoDB Compass`.

### MongoDB Atlas CLI

`mongodb-atlas-cli/internal/compass/compass_bin_windows.go` reads
`HKLM\SOFTWARE\MongoDB\MongoDB Compass` → `Directory`, as described in [§1.3](#13-the-reason-the-fork-is-still-load-bearing-today).

**This dependency is undeclared.** It does not appear in any `package.json` or
`go.mod` relationship; it is a coupling through the Windows registry only.
Changing the registry key path, the value name, or the root hive is a breaking
change for a repository that has no visible dependency on this one.

### Not the MongoDB Server

The Server installer downloads and runs the Squirrel `.exe`; see [§1.1](#11-the-original-motivation-which-no-longer-applies).

### What Compass CI does and does not verify

Compass runs the MSI through a real install on Windows.
`.github/workflows/test-installers.yml` includes a `windows_msi` entry running
on `windows-latest` for the `time-to-first-query` and `auto-update-from` tests
across all three distributions (`auto-update-to` is excluded for this package).
`packages/compass-smoke-tests/src/installers/windows-msi.ts` performs an
`msiexec /package` install and then runs the end-to-end suite against the
installed application.

Consequently, CI **does** catch:

- a `light.exe` failure during packaging;
- an MSI that fails to install;
- a missing application executable after install;
- an application that cannot launch or run a query;
- a broken update-from-this-version path.

CI **does not** catch:

- **Any change to the registry values this package writes.** The MSI installer
  helper makes no registry call. `windows-registry.ts` is imported only by
  `windows-setup.ts` (the Squirrel `.exe`) and queries the standard Uninstall
  key, never `Software\MongoDB\MongoDB Compass`. Removing or renaming the
  `ApplicationInstallLocation` component of change #2 leaves the entire Windows
  matrix green while breaking the Atlas CLI consumer described above.
- **Behaviour at the default install location.** The test passes
  `APPLICATIONROOTDIRECTORY=${sandboxPath}` explicitly, so `Program Files` is
  never used, and `/passive` bypasses the `chooseDirectory` UI. Anything
  specific to the default path or to a user-selected path — including directory
  permissions — is unexercised.
- **Uninstall behaviour.** `uninstall()` is invoked in a `finally` block, but
  nothing asserts what it removed, so the orphaned-folder cleanup of change #3
  has no coverage.
- **The Start Menu shortcut** and the `shortcutFolderName` it is filed under.

The coverage boundary is therefore that CI verifies the installer *works*, not
what the installer *writes*. The one property this fork exists to provide —
the registry layout of [§1.3](#13-the-reason-the-fork-is-still-load-bearing-today) — is the property with no test behind it.

---

## 4. Lineage

| When | What |
| --- | --- |
| Sep 2018 | COMPASS-3117 selects `felixrieseberg/electron-wix-msi` |
| Jan 2019 | Compass adopts upstream (`f6300df4a4`) |
| 2019-02-08 | Fork point: upstream v2.1.1, commit `7f2a003`. Compass switches to the fork in `7cf6603bad`. First publish, `@mongodb-js/electron-wix-msi@2.1.2` |
| Feb 2019 | All functional changes land, 2.1.2 → 2.1.20 |
| 2020 | Package absorbed into the `mongodb-js/compass` monorepo as `packages/electron-wix-msi`; 2.2.0 and 2.2.1 published from there (tests and tooling only) |
| 2021-06-04 | Extracted back to this standalone repo (`156ee29`; `chore(monorepo): remove electron-wix-msi (#2228)` on the Compass side). Version 3.0.0 |
| Dec 2023 | CodeQL workflow added, then removed (`d264d67`, `84ef067`) |
| 2026-09-09 | Repository unarchived; CodeQL workflow and CODEOWNERS re-added (`3c1fa70`, COMPASS-10984) |

Published versions: 2.1.2 through 2.1.20, then 2.2.0, 2.2.1, 3.0.0.

---

## 5. Distance from upstream

Upstream is at **5.1.3** (October 2025) — three major versions ahead of the
v2.1.1 fork point. Capabilities it has gained that this fork does not have:

- Per-user versus per-machine install modes (`defaultInstallMode`, `MSIINSTALLPERUSER`).
- An auto-updater feature and an auto-launch feature (`features`, `autoRun`).
- File association support (`associateExtensions`).
- A `lightSwitches` option for passing arbitrary `light.exe` switches.
- Localization and culture options (`cultures`, `ui.localizations`).
- Code signing via `@electron/windows-sign` (`windowsSign`).
- `util:RemoveFolderEx` bound to the recorded install path.
- Internal use of `util:PermissionEx` (`static/permission.xml`) to grant the
  auto-updater user group write access to specific registry keys.

Upstream capabilities that remain unavailable from configuration, in both
upstream and this fork:

- Declaring arbitrary registry keys or values. Upstream's `registry` array is
  built by a private method and is not exposed through `MSICreatorOptions`.
- Applying ACLs to the installation directory. Upstream's `PermissionEx` usage
  covers registry keys for the updater group only, never
  `APPLICATIONROOTDIRECTORY`. Relevant to
  [COMPASS-10984](https://jira.mongodb.org/browse/COMPASS-10984).

---

## 6. State of this repository

- The `master` branch is at version 3.0.0, published to npm as `@mongodb-js/electron-wix-msi`.
- There is no build or publish automation. Releases have historically been made by hand with `npm version` followed by `npm publish`.
- The test suite is not run on `master` by any CI workflow in this repository. The `.travis.yml` and AppVeyor badges inherited from upstream are not connected to anything.
- The repository was archived and was unarchived on 2026-09-09.
- `README.md` is upstream's, describing upstream's API. It does not document any of the differences in [§2](#2-what-this-fork-changes), and describes options (`features`, `associateExtensions`, `lightSwitches`, and others) that do not exist in this fork.

---

## References

- Upstream: <https://github.com/felixrieseberg/electron-wix-msi>
- Fork point: upstream commit `7f2a003` (v2.1.1)
- [COMPASS-3117](https://jira.mongodb.org/browse/COMPASS-3117) — the spike that selected this package
- [COMPASS-3537](https://jira.mongodb.org/browse/COMPASS-3537) — "Allow User Data Directory to be Configurable" (Mar 2019), related to the `UserDataDirectory` value in change #2
- [COMPASS-10984](https://jira.mongodb.org/browse/COMPASS-10984) — "Lock down MSI install directory permissions"
- Consumer: [`compass/packages/hadron-build/src/lib/target.ts`](https://github.com/mongodb-js/compass/blob/main/packages/hadron-build/src/lib/target.ts)
- Consumer: [`mongodb-atlas-cli/internal/compass/compass_bin_windows.go`](https://github.com/mongodb/mongodb-atlas-cli/blob/master/internal/compass/compass_bin_windows.go)
