#!/usr/bin/env python3
"""Prepare a release update PR; never update the personal branch or device."""
import json
import os
from pathlib import Path
import re
import subprocess

REPO = "JackBewley/nocturne"
BASE = "personal/nocturne"


def run(*args, check=True):
    return subprocess.run(args, text=True, capture_output=True, check=check)


def api(path, payload=None):
    args = ["gh", "api", path]
    if payload is not None:
        args += ["--method", "POST", "--input", "-"]
    result = subprocess.run(args, input=json.dumps(payload) if payload else None,
                            text=True, capture_output=True, check=True)
    return json.loads(result.stdout)


def output(**values):
    with open(os.environ["GITHUB_OUTPUT"], "a") as f:
        for key, value in values.items():
            f.write(f"{key}={value}\n")


def main():
    if os.environ.get("GITHUB_REPOSITORY") != REPO:
        raise RuntimeError("This automation is restricted to JackBewley/nocturne")
    release = api("repos/usenocturne/nocturne/releases/latest")
    tag = release["tag_name"]
    if release["draft"] or release["prerelease"] or not re.fullmatch(r"v\d+\.\d+\.\d+", tag):
        raise RuntimeError("Expected a stable vX.Y.Z upstream release")
    run("git", "fetch", "--no-tags", "https://github.com/usenocturne/nocturne.git", f"refs/tags/{tag}")
    target = run("git", "rev-parse", "FETCH_HEAD^{commit}").stdout.strip()
    if run("git", "merge-base", "--is-ancestor", target, "HEAD", check=False).returncode == 0:
        print(f"Already includes {tag}; no update needed.")
        output(changed="false")
        return
    branch = f"updates/nocturne-{tag}"
    existing = api(f"repos/{REPO}/pulls?state=all&head=JackBewley:{branch}&base={BASE}")
    if existing:
        print(f"Update already tracked: {existing[0]['html_url']}")
        output(changed="false")
        return
    base = run("git", "rev-parse", "HEAD").stdout.strip()
    run("git", "config", "user.name", "github-actions[bot]")
    run("git", "config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com")
    remote = run("git", "ls-remote", "--heads", "origin", branch).stdout.strip()
    conflict = False
    if remote:
        # Recover a previous push whose PR creation failed. Never overwrite it.
        run("git", "fetch", "origin", branch)
        run("git", "checkout", "-B", branch, "FETCH_HEAD")
        conflict = Path("tools/personal/update-conflicts.md").exists()
    else:
        run("git", "checkout", "-b", branch)
        merged = run("git", "merge", "--no-commit", "--no-ff", target, check=False)
        if merged.returncode:
            files = run("git", "diff", "--name-only", "--diff-filter=U").stdout.strip()
            if not files:
                raise RuntimeError(merged.stderr)
            conflict = True
            run("git", "merge", "--abort")
            Path("tools/personal/update-conflicts.md").write_text(
                f"# Manual merge needed: {tag}\n\nTarget commit: {target}\n\n"
                "The upstream merge was aborted; this branch contains no upstream update yet.\n"
                "Resolve the merge, remove this report, then review compatibility.\n\n"
                + "\n".join(f"- `{p}`" for p in files.splitlines()) + "\n")
        else:
            # Keep this fork's automation stable. Upstream workflow changes need separate review.
            run("git", "restore", f"--source={base}", "--staged", "--worktree", ".github/workflows")
        config = Path("tools/personal/config.json")
        data = json.loads(config.read_text())
        data.update(upstreamTag=tag, compatibilityReviewed=False)
        config.write_text(json.dumps(data, indent=2) + "\n")
        run("git", "add", "tools/personal")
        run("git", "commit", "-m", f"Review Nocturne {tag} for personal build")
        run("git", "push", "origin", f"HEAD:refs/heads/{branch}")
    sha = run("git", "rev-parse", "HEAD").stdout.strip()
    body = (f"Official release: https://github.com/usenocturne/nocturne/releases/tag/{tag}\n\n"
            f"Upstream commit: `{target}`\n\n"
            + ("**Merge conflicts need manual resolution. No upstream code has been merged.**\n\n" if conflict else "The upstream release was merged into this update branch. Tests and build run in the linked workflow.\n\n")
            + "Before merging:\n- Review upstream changes and device/daemon compatibility.\n"
              "- Set `requiredImageVersion` and `compatibilityReviewed: true` in `tools/personal/config.json`.\n"
              "- Verify the UI tests/build pass. Remove any conflict report after resolving it.\n"
              "- Use **Create a merge commit** to preserve upstream ancestry.\n\n"
              "Merging a reviewed update publishes a UI-only package. Device installation remains manual. "
              "Upstream workflow files are not adopted automatically.\n\n"
            + f"Automation run: https://github.com/{REPO}/actions/runs/{os.environ['GITHUB_RUN_ID']}\n")
    pr = api(f"repos/{REPO}/pulls", {"title": f"Update personal build to Nocturne {tag}",
             "head": branch, "base": BASE, "body": body, "draft": conflict})
    api(f"repos/{REPO}/issues/{pr['number']}/assignees", {"assignees": ["JackBewley"]})
    output(changed="true", ref=sha, pr=pr["number"], clean=str(not conflict).lower())
    print(pr["html_url"])


if __name__ == "__main__":
    main()
