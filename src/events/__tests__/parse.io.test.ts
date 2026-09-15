/**
 * I/O failures of `parseEventDefinitions` - a missing or unreadable
 * definitions file, typed as `IoError` so a programmatic caller can
 * switch on the class rather than on a message.
 */

import fs from 'node:fs';

import { makeErrnoError } from '../../shared/__tests__/helpers/errnoError';
import { mockReadFailure } from '../../shared/__tests__/helpers/readFailure';
import { useTempDirectory } from '../../shared/__tests__/helpers/tempDirectory';
import { IoError } from '../../shared/errors';
import { parseEventDefinitions } from '../parseEventDefinitions';

import {
  DEFINITIONS_FILE_NAME,
  definitionsFileIn,
  writeDefinitionsFile,
} from './helpers/definitionsFile';

describe('parseEventDefinitions: I/O failures', () => {
  const directory = useTempDirectory('keewano-codegen-parse-io-');
  const file = (): string => definitionsFileIn(directory());

  it('throws IoError when the definitions file does not exist', () => {
    /** Missing is I/O, not validation: there is no document to judge, and a project without one has not declared its first event. */
    expect(() => parseEventDefinitions({ inputFile: file() })).toThrow(IoError);
    expect(() => parseEventDefinitions({ inputFile: file() })).toThrow(/not found/);
  });

  it('wraps a statSync failure that is not ENOENT as IoError', () => {
    /** A permission-denied stat is I/O, not "file missing". */
    const spy = jest.spyOn(fs, 'statSync').mockImplementation(() => {
      throw makeErrnoError('EACCES');
    });
    try {
      expect(() => parseEventDefinitions({ inputFile: file() })).toThrow(IoError);
      expect(() => parseEventDefinitions({ inputFile: file() })).toThrow(/cannot stat/);
    } finally {
      spy.mockRestore();
    }
  });

  it('wraps an unreadable file as IoError, not as a validation failure', () => {
    writeDefinitionsFile({ file: file(), events: [{ name: 'Locked', type: 0 }] });
    const spy = mockReadFailure({ pathSuffix: DEFINITIONS_FILE_NAME, code: 'EACCES' });
    try {
      expect(() => parseEventDefinitions({ inputFile: file() })).toThrow(IoError);
      expect(() => parseEventDefinitions({ inputFile: file() })).toThrow(/cannot read file/);
    } finally {
      spy.mockRestore();
    }
  });
});
