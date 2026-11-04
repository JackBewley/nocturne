#!/usr/bin/env bash
set -euo pipefail
# Run on your Mac. Downloads a published personal build; no VPS required.
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
base=https://github.com/JackBewley/nocturne/releases/latest/download
curl -fLsS "$base/personal-ui-bundle.tar.gz" -o "$work/personal-ui-bundle.tar.gz"
curl -fLsS "$base/SHA256SUMS" -o "$work/SHA256SUMS"
(cd "$work" && shasum -a 256 -c SHA256SUMS)
mkdir "$work/package"
tar -xzf "$work/personal-ui-bundle.tar.gz" -C "$work/package"
(cd "$work/package" && shasum -a 256 -c SHA256SUMS)
ssh root@nocturne.local 'mkdir -p /tmp/nocturne-personal-install'
scp "$work/package/"* root@nocturne.local:/tmp/nocturne-personal-install/
ssh root@nocturne.local 'sh /tmp/nocturne-personal-install/install-device.sh'
