import type { LegacyEvent } from './legacyDirectory';

/**
 * What reading one file of the old layout gave.
 *
 * event - the definition it held, when it held one.
 * problem - why it could not be read, or what an old-shaped file said
 *   that the old format never allowed; absent for a file that reads
 *   fine but is not an old definition.
 */
interface LegacyRead {
  event?: LegacyEvent;
  problem?: string;
}

export type { LegacyRead };
