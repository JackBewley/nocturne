#!/usr/bin/env python3
"""Package only builds with an explicitly reviewed image compatibility target."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parents[2]


def validated_config(data):
    if data.get("compatibilityReviewed") is not True:
        return None
    version = data.get("requiredImageVersion", "")
    if not re.fullmatch(r"\d+\.\d+\.\d+(?:\+[0-9]+)?", version):
        raise ValueError("Invalid required image version")
    if not re.fullmatch(r"v\d+\.\d+\.\d+", data.get("upstreamTag", "")):
        raise ValueError("Invalid upstream tag")
    return data


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def archive(path, folder, files):
    with tarfile.open(path, "w:gz") as tar:
        for p in files:
            if p.is_symlink():
                raise ValueError(f"Unexpected symlink: {p}")
            tar.add(p, arcname=p.relative_to(folder).as_posix())


def outputs(**values):
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a") as f:
            for k, v in values.items():
                f.write(f"{k}={v}\n")


def main():
    config = validated_config(json.loads((ROOT / "tools/personal/config.json").read_text()))
    if not config or (ROOT / "tools/personal/update-conflicts.md").exists():
        print("UI verified; installable package withheld pending compatibility/merge review.")
        outputs(packaged="false")
        if os.environ.get("GITHUB_STEP_SUMMARY"):
            with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as f:
                f.write("Installable package withheld: review tools/personal/config.json and resolve any conflict report.\n")
        return
    sha = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    tag = f"personal-{config['upstreamTag']}-{sha[:12]}"
    dist = ROOT / "packages/ui/dist"
    if not (dist / "index.html").is_file():
        raise ValueError("Build the UI first")
    (dist / "personal-build.txt").write_text(tag + "\n")
    files = sorted(p for p in dist.rglob("*") if p.is_file() and
                   not p.name.startswith("preview-") and
                   p.name not in {"personal-files.sha256", "playback-files.sha256", "playback-build.txt"})
    manifest = dist / "personal-files.sha256"
    manifest.write_text("".join(f"{digest(p)}  {p.relative_to(dist).as_posix()}\n" for p in files))
    out = ROOT / "personal-dist"
    out.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as temp:
        stage = Path(temp)
        archive(stage / "ui.tar.gz", dist, files + [manifest])
        (stage / "required-image-version.txt").write_text(config["requiredImageVersion"] + "\n")
        (stage / "install-device.sh").write_bytes((ROOT / "tools/personal/install-device.sh").read_bytes())
        members = sorted(stage.iterdir())
        checks = stage / "SHA256SUMS"
        checks.write_text("".join(f"{digest(p)}  {p.name}\n" for p in members))
        archive(out / "personal-ui-bundle.tar.gz", stage, members + [checks])
    (out / "SHA256SUMS").write_text(f"{digest(out / 'personal-ui-bundle.tar.gz')}  personal-ui-bundle.tar.gz\n")
    (out / "RELEASE.md").write_text(
        f"Personal UI built from `{sha}`. Includes Minimal Clock and Spotify palette backgrounds.\n\n"
        f"Upstream baseline: {config['upstreamTag']}. Required Nocturne image: **{config['requiredImageVersion']}**.\n\n"
        "UI-only package. Does not install firmware or a daemon. Keep Nocturne Automatic Updates off.\n\n"
        "Run on your Mac:\n```sh\n"
        "curl -fsSL https://raw.githubusercontent.com/JackBewley/nocturne/personal/nocturne/tools/personal/install-latest.sh | bash\n"
        "```\n\nThe installer verifies checksums and image version, backs up the existing UI, then restarts the kiosk.\n")
    outputs(packaged="true", tag=tag)
    print(f"Packaged {tag}")


if __name__ == "__main__":
    main()
