# Personal Nocturne updates

`personal/nocturne` contains Jack's UI customizations. `main` remains the fork's default and hosts the scheduled workflow; it is otherwise kept separate. The Minimal Clock contribution branch is unchanged.

The Personal Nocturne workflow checks official stable GitHub releases daily at 14:23 UTC. It opens one assigned PR per new release against `personal/nocturne`. Clean merges run UI tests and the production build. Conflicts produce a draft PR with a report, never conflict markers in application code. Existing update PRs are not overwritten or duplicated. Closing a PR declines that release; reopen it to continue. Workflow files from upstream require separate review.

Review a new release's daemon/API and image requirements, then set `requiredImageVersion` and `compatibilityReviewed: true` in `config.json`. The watcher deliberately resets the review flag for each release. Passing UI tests alone is not a compatibility review. Resolve and remove any conflict report. Merge with **Create a merge commit**, not squash/rebase, to preserve upstream ancestry. A successful push to the personal branch tests, builds, packages, and publishes the reviewed UI to this fork's Releases. No firmware/daemon update or device installation runs automatically.

Run **Actions > Personal Nocturne > Run workflow** on `main`, with `check` to check now or `build` to package the current personal branch. The workflow exists on both main and personal; keep the two copies aligned when editing it. Read-only test jobs have no saved Git credentials. Only the discovery and publication jobs get narrowly scoped write permissions. No personal token or device SSH key is needed on GitHub.

On your Mac, install the latest published custom UI:

```sh
curl -fsSL https://raw.githubusercontent.com/JackBewley/nocturne/personal/nocturne/tools/personal/install-latest.sh | bash
```

The script downloads the latest personal release, verifies checksums, copies it to `nocturne.local`, checks the exact image version, backs up the existing UI under `/var/lib`, installs the UI, and verifies the served build marker. A mismatch stops before changing the UI. Install a required official firmware/daemon update separately before applying a matching custom UI. Keep **Software Update > Update Settings > Automatic Updates** off on the device. The installer does not alter this setting.

GitHub must have Actions enabled and **Allow GitHub Actions to create and approve pull requests** enabled (the workflow only creates PRs, never approves or merges them). Default token permissions can stay read-only. Subscribe to this fork's PRs/releases for notifications. GitHub may pause scheduled workflows in public repositories after 60 days without repository activity; re-enable from Actions if that happens. Scheduled runs are best effort, not an exact-time guarantee.

## v4.1.10 compatibility review

The personal build merges official tag v4.1.10. It accepts image 4.1.10, or image 4.1.9 with the installed v4.1.10 component overlay (including numeric build suffixes). The overlay marker, daemon, and UI entry must all be regular files, matching upstream version detection.
The upstream delta does not change shared wire contracts or the palette transport.
All 17 custom UI source files are unchanged from personal commit 55f8140.
Verification: 442 UI tests, 9 automation tests, and the production UI build pass.
The user confirmed image 4.1.9 with component version 4.1.10+20261124001143. Custom UI installation verification remains pending. Install the official v4.1.10 update first,
then the matching personal UI bundle. Mac Connector v2.1.7 ships as version 1.0,
build 300. Keep automatic firmware updates disabled after installation.
