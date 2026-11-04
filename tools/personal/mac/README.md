# Nocturne Mac tools

Put these files in `~/Projects/_tools/nocturne` and run:

```sh
chmod +x ~/Projects/_tools/nocturne/nocturne ~/Projects/_tools/nocturne/Nocturne.command
gh auth login --hostname github.com --web
```

GitHub CLI (`gh`) is already installed on Jack's Mac, but needs its own login even when the browser is signed in. Select GitHub.com and follow the browser sign-in. If using a different Mac, install it with `brew install gh` first.

Double-click `Nocturne.command` for a menu, or run:

```sh
cd ~/Projects/_tools/nocturne
./nocturne status
./nocturne check
./nocturne updates
./nocturne build
./nocturne install
./nocturne device
```

`check` asks GitHub to look for a new official release now. It returns immediately; use `actions` or `status` to see the result. New updates become review PRs, with conflicts or compatibility review called out. Review and merge using **Create a merge commit**. A successful reviewed build is published automatically.

`build` rebuilds the current personal branch; it does not merge updates or bypass the firmware compatibility review.

`install` installs the latest published personal UI, not an unmerged PR or an unfinished build. It downloads both assets from the same release, verifies checksums, and connects to `root@nocturne.local` using your existing SSH setup. The device installer checks its image version, backs up the current UI, installs, and restarts the kiosk. The device must be reachable from your Mac. No VPS connection is needed. Firmware and daemon updates remain separate.

Keep Nocturne's **Software Update > Update Settings > Automatic Updates** off. These scripts do not change that preference or install anything on a schedule.
