/**
 * The exit-code classifier. A CI script branches on these numbers, so
 * the mapping of each error shape is pinned, including the one that
 * used to be wrong: Node's `ERR_*` programming errors were routed to
 * IO as if a file were missing.
 */
import { makeErrnoError } from '../../shared/__tests__/helpers/errnoError';
import { EmitError, IoError, ParseError } from '../../shared/errors';
import { EXIT_CODES, classifyExitCode } from '../exitCode';

describe('classifyExitCode', () => {
  it.each([
    ['ParseError', new ParseError('x'), EXIT_CODES.VALIDATION],
    ['IoError', new IoError('x'), EXIT_CODES.IO],
    ['EmitError', new EmitError('x'), EXIT_CODES.INTERNAL],
    ['fs errno', makeErrnoError('EACCES'), EXIT_CODES.IO],
    ['Node fs ERR_FS_* code', makeErrnoError('ERR_FS_EISDIR'), EXIT_CODES.IO],
    ['Node ERR_* code', makeErrnoError('ERR_INVALID_ARG_TYPE'), EXIT_CODES.INTERNAL],
    ['plain TypeError', new TypeError('x'), EXIT_CODES.INTERNAL],
    ['non-error value', 'boom', EXIT_CODES.INTERNAL],
  ])('maps %s', (_label, error, expected) => {
    expect(classifyExitCode(error)).toBe(expected);
  });
});
