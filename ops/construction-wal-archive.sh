#!/usr/bin/env bash
# PostgreSQL archive_command: publish immutable local WAL, never overwrite it.
set -euo pipefail
umask 077
source_file=${1:?WAL source required}
name=${2:?WAL filename required}
archive_dir=${WAL_ARCHIVE_DIR:-/var/lib/postgresql/wal_archive}
archive_dir=${archive_dir%/}
[[ "$archive_dir" == /* && "$archive_dir" != / && "$archive_dir" != *//* && ! "$archive_dir" =~ (^|/)\.\.?(/|$) ]] || {
  echo 'Archive directory must be an absolute, canonical path' >&2; exit 1;
}
# Reject symlinks before creating anything, including in existing parent paths.
parent=$archive_dir
while [[ "$parent" != / ]]; do
  [[ ! -L "$parent" ]] || { echo 'Archive path cannot contain symlinks' >&2; exit 1; }
  parent=${parent%/*}; [[ -n "$parent" ]] || parent=/
done
[[ "$name" =~ ^([0-9A-F]{24}(\.[0-9A-F]{8}\.backup|\.partial)?|[0-9A-F]{8}\.history)$ ]] || {
  echo 'Invalid WAL filename' >&2; exit 1;
}
[[ -f "$source_file" && -s "$source_file" && ! -L "$source_file" ]] || { echo 'Missing, empty or symlink WAL source' >&2; exit 1; }
mkdir -p "$archive_dir"
mode=$(stat -c %a "$archive_dir")
if [[ "$(stat -c %u "$archive_dir")" != "$EUID" ]] || (( (8#$mode & 077) != 0 )); then
  echo 'Archive directory must be owned by this user and private' >&2; exit 1
fi
destination="$archive_dir/$name"
[[ ! -L "$destination" ]] || { echo 'Archive destination cannot be a symlink' >&2; exit 1; }
if [[ -e "$destination" ]]; then
  [[ -f "$destination" ]] || { echo 'Archive destination must be a regular file' >&2; exit 1; }
  mode=$(stat -c %a "$destination")
  if [[ "$(stat -c %u "$destination")" != "$EUID" ]] || (( (8#$mode & 077) != 0 )); then
    echo 'Existing WAL must be owned by this user and private' >&2; exit 1
  fi
  cmp -s "$source_file" "$destination" || { echo 'Existing WAL has different contents' >&2; exit 1; }
  sync
  exit 0
fi
temporary=$(mktemp "$archive_dir/.pending-wal-XXXXXXXX")
trap 'rm -f -- "$temporary"' EXIT
cp -- "$source_file" "$temporary"
# Hard-link publication is atomic and cannot replace a concurrently created file.
if ! ln -- "$temporary" "$destination" 2>/dev/null; then
  if [[ ! -f "$destination" || -L "$destination" ]] || ! cmp -s "$temporary" "$destination"; then
    echo 'Concurrent WAL publication differs' >&2; exit 1
  fi
fi
# A successful archive_command must mean bytes and directory entry are durable.
sync
