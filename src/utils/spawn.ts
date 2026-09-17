import childProcess from 'child_process';
import createDebug from 'debug';

const debug = createDebug('electron-wix-msi');

export interface SpawnPromiseResult {
  stdout: string;
  stderr: string;
  code: number;
}

/**
 * Spawn a process as a promise
 *
 * @param {string} name
 * @param {Array<string>} args
 * @param {SpawnOptions} [options]
 * @returns {Promise<SpawnPromiseResult>}
 */
export function spawnPromise(
  name: string,
  args: Array<string>,
  options?: childProcess.SpawnOptions,
): Promise<SpawnPromiseResult> {
  return new Promise((resolve) => {
    const fork = childProcess.spawn(name, args, options ?? {});

    debug(`Spawning ${name} with ${args.join(' ')}`);

    let stdout = '';
    let stderr = '';

    fork.stdout?.on('data', (data: Buffer | string) => {
      debug(`Spawn ${name} stdout: ${String(data)}`);
      stdout += data;
    });

    fork.stderr?.on('data', (data: Buffer | string) => {
      debug(`Spawn ${name} stderr: ${String(data)}`);
      stderr += data;
    });

    fork.on('close', (code: number) => {
      debug(`Spawn ${name}: Child process exited with code ${code}`);
      resolve({ stdout, stderr, code });
    });
  });
}
