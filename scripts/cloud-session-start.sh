#!/bin/bash
# SessionStart hook (.claude/settings.json) for cloud sessions, which run
# on Anthropic's machines instead of Jerry's PC (docs/design/cloud-sessions.md).
# Local sessions return at once. In the cloud it:
#   1. puts the Node version CI uses (.nvmrc) on PATH: the cloud machine
#      ships Node 20-22, and the scripts and Vitest want what CI runs;
#   2. runs npm ci when package-lock.json or .nvmrc has changed.
# It never fails the session: a problem is reported to Claude and the
# session goes on.

[ "$CLAUDE_CODE_REMOTE" = "true" ] || exit 0
cd "$CLAUDE_PROJECT_DIR" || exit 0

want=$(tr -dc '0-9' < .nvmrc)
dir="$HOME/.local/node$want"

major() { node -p 'process.versions.node.split(".")[0]' 2>/dev/null; }

if [ "$(major)" != "$want" ]; then
  if [ ! -x "$dir/bin/node" ]; then
    # The newest release of that major line, checked against Node's own
    # published checksums before it is unpacked.
    base="https://nodejs.org/dist/latest-v$want.x"
    tmp=$(mktemp -d)
    if curl -fsSL "$base/SHASUMS256.txt" -o "$tmp/SHASUMS256.txt"; then
      name=$(grep -o "node-v[0-9.]*-linux-x64.tar.gz" "$tmp/SHASUMS256.txt" | head -1)
      if [ -n "$name" ] && curl -fsSL "$base/$name" -o "$tmp/$name" \
        && (cd "$tmp" && grep " $name\$" SHASUMS256.txt | sha256sum --check --status); then
        mkdir -p "$dir" && tar -xzf "$tmp/$name" -C "$dir" --strip-components=1
      fi
    fi
    rm -rf "$tmp"
  fi
  if [ -x "$dir/bin/node" ]; then
    export PATH="$dir/bin:$PATH"
    [ -n "$CLAUDE_ENV_FILE" ] && echo "export PATH=\"$dir/bin:\$PATH\"" >> "$CLAUDE_ENV_FILE"
  fi
fi

if [ "$(major)" != "$want" ]; then
  echo "Cloud session setup: could not install Node $want (.nvmrc); node is $(node -v 2>/dev/null). Scripts that run .ts files may fail."
  exit 0
fi

stamp=node_modules/.cloud-install.sha256
if ! sha256sum --check --status "$stamp" 2>/dev/null; then
  rm -f "$stamp"
  if npm ci --no-audit --no-fund > /tmp/npm-ci.log 2>&1; then
    sha256sum package-lock.json .nvmrc > "$stamp"
  else
    echo "Cloud session setup: npm ci failed (log in /tmp/npm-ci.log)."
    exit 0
  fi
fi

echo "Cloud session setup: Node $(node -v) from .nvmrc is on PATH and the npm packages are installed."
exit 0
