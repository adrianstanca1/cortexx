#!/usr/bin/env python3
"""Check the supported, single-tablespace physical archive without extracting it."""
import sys
import tarfile


def validate(archive_path):
    seen = set()
    required = {"PG_VERSION", "backup_label", "backup_manifest"}
    with tarfile.open(archive_path, "r:gz") as archive:
        for member in archive:
            name = member.name
            if name.startswith("./"):
                name = name[2:]
            name = name.rstrip("/")
            if name == "." and member.isdir():
                continue
            if not name or name.startswith("/") or any(
                part in ("", ".", "..") for part in name.split("/")
            ) or any(char in name for char in "\r\n\\"):
                raise ValueError("Unsafe archive member path")
            if name in seen or not (member.isfile() or member.isdir()):
                raise ValueError("Duplicate, link or special archive member")
            seen.add(name)
            if name in required and not member.isfile():
                raise ValueError("Required backup member must be a regular file")
            if name == "PG_VERSION":
                if member.size != 3 or archive.extractfile(member).read() != b"16\n":
                    raise ValueError("Only PostgreSQL 16 backups are supported")
            if name == "tablespace_map" and member.size:
                raise ValueError("External tablespaces are not supported")
        if not required.issubset(seen):
            raise ValueError("Missing required physical backup members")


if __name__ == "__main__":
    try:
        validate(sys.argv[1])
    except (OSError, ValueError, tarfile.TarError, IndexError) as error:
        print(f"Invalid physical backup: {error}", file=sys.stderr)
        sys.exit(1)
