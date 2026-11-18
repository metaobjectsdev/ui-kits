#!/usr/bin/env bash
# Packs the three packages at the current commit for a consumer to vendor:
#   scripts/pack-vendor.sh <out-dir>
# writes <out-dir>/admin-tokens-<sha7>.tgz, admin-css-<sha7>.tgz and admin-react-<sha7>.tgz,
# each built first (admin-react's dist/ is inside). The tarballs are named after the commit, so
# the working tree must be clean: a tarball named for a commit holds exactly that commit.
# Pointing the consumer's package.json at the files is the consumer's job.
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "usage: scripts/pack-vendor.sh <out-dir>" >&2
  exit 2
fi
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "$1"
out="$(cd "$1" && pwd)"

if [ -n "$(git -C "$root" status --porcelain)" ]; then
  echo "pack-vendor: the working tree has uncommitted changes; commit or stash them first" >&2
  exit 1
fi
sha="$(git -C "$root" rev-parse --short=7 HEAD)"

pnpm -C "$root" install --frozen-lockfile
pnpm -C "$root" build

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
for name in admin-tokens admin-css admin-react; do
  pnpm -C "$root/packages/$name" pack --pack-destination "$work" >/dev/null
  packed=("$work"/*-"$name"-*.tgz)
  if [ "${#packed[@]}" -ne 1 ] || [ ! -f "${packed[0]}" ]; then
    echo "pack-vendor: expected one tarball for $name in $work" >&2
    exit 1
  fi
  mv "${packed[0]}" "$out/$name-$sha.tgz"
  echo "$out/$name-$sha.tgz"
done

# List first: `tar | grep -q` would fail under pipefail when grep stops reading early.
listing="$(tar -tzf "$out/admin-react-$sha.tgz")"
grep -qx 'package/dist/index.js' <<<"$listing" || {
  echo "pack-vendor: admin-react-$sha.tgz has no dist/index.js" >&2
  exit 1
}
