#!/bin/bash
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")" || exit 1
/bin/bash ./nocturne menu
result=$?
if [ "$result" -ne 0 ]; then
  echo "Command failed (exit $result). See the message above."
fi
read -r -p 'Press Return to close this window.' ignored
exit "$result"
