/**
 * Make `readFileSync` fail with `code` for paths ending in `pathSuffix`
 * and behave normally otherwise. Returns the spy; the caller restores it.
 */

import type { MockReadFailureArgs } from '../types/readFailure';

import fs from 'node:fs';

import { makeErrnoError } from './errnoError';

function mockReadFailure({ pathSuffix, code }: MockReadFailureArgs): jest.SpyInstance {
  const realRead = fs.readFileSync;
  return jest.spyOn(fs, 'readFileSync').mockImplementation((...readArgs) => {
    if (String(readArgs[0]).endsWith(pathSuffix)) throw makeErrnoError(code);
    return realRead(...readArgs);
  });
}

export { mockReadFailure };
