import { createAvatar } from '@dicebear/core';
import { bottts } from '@dicebear/collection';

/** Generate a deterministic avatar image as a data URI (no remote request). */
export function avatarDataUri(seed: string, size = 56): string {
  return createAvatar(bottts, {
    seed,
    size,
    radius: 50,
  }).toDataUri();
}
