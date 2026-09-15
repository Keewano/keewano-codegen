/**
 * The errno helper: which thrown shapes count as a filesystem failure.
 * The exit-code classifier relies on it, so the boundary between
 * Node's `ERR_*` programming errors and real I/O codes is pinned here.
 */
import { getErrnoCode, isFsErrnoError, isNotFoundError } from '../errno';

import { makeErrnoError } from './helpers/errnoError';

describe('getErrnoCode', () => {
  it('returns the string code of an errno-shaped error', () => {
    expect(getErrnoCode(makeErrnoError('ENOENT'))).toBe('ENOENT');
  });

  it.each([null, undefined, 'ENOENT', 42, {}, Object.assign(new Error('x'), { code: 13 })])(
    'returns undefined for %p',
    (value) => {
      expect(getErrnoCode(value)).toBeUndefined();
    },
  );
});

describe('isFsErrnoError', () => {
  it.each(['ENOENT', 'EACCES', 'EISDIR', 'EBUSY', 'EPERM', 'ERR_FS_EISDIR'])(
    'accepts %s',
    (code) => {
      expect(isFsErrnoError(makeErrnoError(code))).toBe(true);
    },
  );

  it('accepts UNKNOWN, the one I/O code that does not start with E', () => {
    /**
     * libuv reports it when Windows returns a status it has no errno
     * for - a locked file, a share that went away. Classified as a bug
     * it would print a stack and exit 3 instead of the I/O code a CI
     * script branches on.
     */
    expect(isFsErrnoError(makeErrnoError('UNKNOWN'))).toBe(true);
  });

  it.each(['ERR_INVALID_ARG_TYPE', 'ERR_MODULE_NOT_FOUND', 'enoent', 'E', 'X_ENOENT'])(
    'rejects %s',
    (code) => {
      expect(isFsErrnoError(makeErrnoError(code))).toBe(false);
    },
  );
});

describe('isNotFoundError', () => {
  it('is true only for ENOENT', () => {
    expect(isNotFoundError(makeErrnoError('ENOENT'))).toBe(true);
    expect(isNotFoundError(makeErrnoError('EACCES'))).toBe(false);
    expect(isNotFoundError(new Error('ENOENT'))).toBe(false);
  });
});
