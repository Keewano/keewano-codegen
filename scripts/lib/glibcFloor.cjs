/**
 * The oldest glibc a Linux executable can run on, read out of the file.
 *
 * The wheels are tagged manylinux, which is a promise to pip that the binary
 * runs against a stated glibc. Nothing enforced it: the tag is a string in a
 * table, and the executable is assembled on a host whose own glibc is far
 * newer. Today the promise holds because bun embeds a runtime linked against an
 * old glibc rather than compiling one here - but that is bun's choice, not
 * ours, and it would change silently. A wheel that breaks it installs cleanly
 * and dies on the first run with a version error naming a symbol.
 *
 * The versioned symbols an ELF needs are listed in .gnu.version_r: one Verneed
 * per shared library, and one Vernaux per version inside it. The names are read
 * from the string table that section links to, never scanned for across the
 * whole file, because an 80 MB runtime carries such strings as data.
 */
'use strict';

const { readFileSync } = require('node:fs');

/** Section type SHT_GNU_verneed: the versions this object needs from others. */
const SHT_GNU_VERNEED = 0x6ffffffe;

/** Offsets into the ELF64 header and the two version records. */
const ELF = {
  SECTION_OFFSET: 0x28,
  SECTION_ENTRY_SIZE: 0x3a,
  SECTION_COUNT: 0x3c,
  SECTION_TYPE: 4,
  SECTION_LINK: 40,
  SECTION_DATA: 24,
  VERNEED_AUX: 8,
  VERNEED_NEXT: 12,
  VERNAUX_NAME: 8,
  VERNAUX_NEXT: 12,
};

/** A version string as a comparable pair, so 2.9 sorts below 2.17. */
function parseVersion(name) {
  const digits = /^GLIBC_(\d+)\.(\d+)/.exec(name);
  return digits === null ? null : { major: Number(digits[1]), minor: Number(digits[2]) };
}

/** Whether `candidate` is newer than `best`, which is null until one is found. */
function isHigher({ candidate, best }) {
  if (best === null) return true;
  if (candidate.major !== best.major) return candidate.major > best.major;
  return candidate.minor > best.minor;
}

/** The null-terminated name at `offset` in the string table starting at `start`. */
function stringAt({ image, start, offset }) {
  const from = start + offset;
  const end = image.indexOf(0, from);
  return image.toString('utf8', from, end === -1 ? from : end);
}

/** The version names in one Verneed's chain of Vernaux records. */
function auxVersions({ image, need, stringsAt }) {
  const names = [];
  let aux = need + image.readUInt32LE(need + ELF.VERNEED_AUX);
  let step = 0;
  do {
    const offset = image.readUInt32LE(aux + ELF.VERNAUX_NAME);
    names.push(stringAt({ image, start: stringsAt, offset }));
    step = image.readUInt32LE(aux + ELF.VERNAUX_NEXT);
    aux += step;
  } while (step !== 0);
  return names;
}

/** Every version name one verneed section requires, across all its libraries. */
function neededVersions({ image, section, sectionsAt, entrySize }) {
  const strings = sectionsAt + image.readUInt32LE(section + ELF.SECTION_LINK) * entrySize;
  const stringsAt = Number(image.readBigUInt64LE(strings + ELF.SECTION_DATA));
  const names = [];
  let need = Number(image.readBigUInt64LE(section + ELF.SECTION_DATA));
  let step = 0;
  do {
    names.push(...auxVersions({ image, need, stringsAt }));
    step = image.readUInt32LE(need + ELF.VERNEED_NEXT);
    need += step;
  } while (step !== 0);
  return names;
}

/**
 * The highest GLIBC_x.y any versioned symbol in `path` requires.
 *
 * @returns The version, or null when the file needs no versioned glibc symbol
 *   at all - a static binary, which no manylinux tag constrains.
 */
function highestGlibcRequired(path) {
  const image = readFileSync(path);
  const sectionsAt = Number(image.readBigUInt64LE(ELF.SECTION_OFFSET));
  const entrySize = image.readUInt16LE(ELF.SECTION_ENTRY_SIZE);
  const count = image.readUInt16LE(ELF.SECTION_COUNT);

  let highest = null;
  for (let index = 0; index < count; index += 1) {
    const section = sectionsAt + index * entrySize;
    if (image.readUInt32LE(section + ELF.SECTION_TYPE) !== SHT_GNU_VERNEED) continue;
    for (const name of neededVersions({ image, section, sectionsAt, entrySize })) {
      const candidate = parseVersion(name);
      if (candidate !== null && isHigher({ candidate, best: highest })) highest = candidate;
    }
  }
  return highest;
}

module.exports = { highestGlibcRequired };
