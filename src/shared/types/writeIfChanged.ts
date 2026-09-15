/**
 * Arguments of `writeIfChanged`.
 *
 * path - absolute path of the file to write.
 * text - the complete new content; compared byte for byte with the
 *   existing file before anything is written.
 */
interface WriteIfChangedArgs {
  path: string;
  text: string;
}

/**
 * Arguments of `carryPermissions`.
 *
 * from - the file being replaced; its permissions are the ones to keep.
 * to - the replacement, still under its temporary name.
 */
interface CarryPermissionsArgs {
  from: string;
  to: string;
}

export type { CarryPermissionsArgs, WriteIfChangedArgs };
