#!/bin/sh
# AnyDock installer:  curl -fsSL https://anydock.ai/install.sh | sh
# Installs the CLI into ~/.anydock/bin, puts `anydock` on your PATH, then runs `anydock setup`
# (browser sign-in, connect Claude Code + Codex, background sync). Re-run any time; every step is idempotent.
# ANYDOCK_NO_SETUP=1 installs only (agents use this, then run the steps themselves — see /agents.md).
set -eu

SERVER="${ANYDOCK_SERVER:-https://anydock.ai}"
ANYDOCK_DIR="${ANYDOCK_HOME:-$HOME/.anydock}"
BIN="$ANYDOCK_DIR/bin"

say() { printf '%s\n' "$*"; }
fail() { printf 'AnyDock install failed: %s\n' "$*" >&2; exit 1; }

# Node.js 22+. Use the system's if it's new enough; otherwise download the official LTS build from nodejs.org into
# ~/.anydock/node (checksum-verified, no sudo, the system Node is left alone). Only if that fails do we ask the user.
NODE_DIR="$ANYDOCK_DIR/node"
node_ok() { [ -x "$1" ] && [ "$("$1" -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)" -ge 22 ]; }

install_node() {
  case "$(uname -s)" in Darwin) os=darwin ;; Linux) os=linux ;; *) return 1 ;; esac
  case "$(uname -m)" in arm64|aarch64) arch=arm64 ;; x86_64|amd64) arch=x64 ;; *) return 1 ;; esac
  # Newest LTS release (index.json lists newest first, one release per line; LTS entries carry a codename).
  index="$(curl -fsSL https://nodejs.org/dist/index.json)" || return 1
  version="$(printf '%s\n' "$index" | grep '"lts":"' | head -n 1 | sed 's/^.*"version":"\(v[0-9.]*\)".*$/\1/')"
  case "$version" in v[0-9]*) ;; *) return 1 ;; esac
  file="node-$version-$os-$arch.tar.gz"
  say "Node.js 22+ not found; installing Node.js $version for AnyDock into $NODE_DIR …"
  tmp="$(mktemp -d)"
  curl -fsSL "https://nodejs.org/dist/$version/$file" -o "$tmp/$file" || { rm -rf "$tmp"; return 1; }
  want="$(curl -fsSL "https://nodejs.org/dist/$version/SHASUMS256.txt" | grep " $file\$" | cut -d' ' -f1)"
  if command -v shasum >/dev/null 2>&1; then got="$(shasum -a 256 "$tmp/$file" | cut -d' ' -f1)"; else got="$(sha256sum "$tmp/$file" | cut -d' ' -f1)"; fi
  [ -n "$want" ] && [ "$want" = "$got" ] || { rm -rf "$tmp"; say "Node.js download failed its checksum."; return 1; }
  tar -xzf "$tmp/$file" -C "$tmp" || { rm -rf "$tmp"; return 1; }
  rm -rf "$NODE_DIR" && mkdir -p "$ANYDOCK_DIR" && mv "$tmp/node-$version-$os-$arch" "$NODE_DIR"
  rm -rf "$tmp"
  node_ok "$NODE_DIR/bin/node"
}

NODE="$(command -v node || true)"
if [ -n "${ANYDOCK_FORCE_NODE_DOWNLOAD:-}" ] || ! node_ok "${NODE:-/nonexistent}"; then
  if node_ok "$NODE_DIR/bin/node"; then
    NODE="$NODE_DIR/bin/node"
  elif install_node; then
    NODE="$NODE_DIR/bin/node"
  else
    fail "AnyDock needs Node.js 22 or newer and couldn't install it automatically. Install it from https://nodejs.org (or: brew install node) and re-run."
  fi
fi

say "Installing AnyDock from $SERVER …"
mkdir -p "$BIN"
TMP="$BIN/anydock.mjs.download"
# Read the release first (never from a cache), then fetch exactly that build.
EXPECTED="$(curl -fsSL "$SERVER/cli/version.json?t=$(date +%s)" | "$NODE" -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).sha256))')"
curl -fsSL "$SERVER/cli/anydock.mjs?sha=$EXPECTED" -o "$TMP" || fail "could not download $SERVER/cli/anydock.mjs"
ACTUAL="$("$NODE" -e 'const c=require("crypto"),f=require("fs");console.log(c.createHash("sha256").update(f.readFileSync(process.argv[1])).digest("hex"))' "$TMP")"
[ "$EXPECTED" = "$ACTUAL" ] || { rm -f "$TMP"; fail "checksum mismatch; please try again."; }
mv "$TMP" "$BIN/anydock.mjs"

# Launcher pins this node so agents (which may run with a minimal PATH) can always start AnyDock.
{
  printf '#!/bin/sh\n'
  [ "$SERVER" = "https://anydock.ai" ] || printf 'export ANYDOCK_SERVER="${ANYDOCK_SERVER:-%s}"\n' "$SERVER"
  printf 'exec "%s" "%s" "$@"\n' "$NODE" "$BIN/anydock.mjs"
} > "$BIN/anydock"
chmod 755 "$BIN/anydock" "$BIN/anydock.mjs"

# Put it on PATH: reuse ~/.local/bin if it's already there, otherwise add ~/.anydock/bin to the shell profile.
on_path() { case ":$PATH:" in *":$1:"*) return 0 ;; *) return 1 ;; esac; }
if on_path "$BIN"; then
  :
elif on_path "$HOME/.local/bin" && [ -d "$HOME/.local/bin" ]; then
  ln -sf "$BIN/anydock" "$HOME/.local/bin/anydock"
else
  case "${SHELL:-}" in
    */zsh) PROFILE="$HOME/.zshrc" ;;
    */bash) PROFILE="$HOME/.bashrc" ;;
    *) PROFILE="$HOME/.profile" ;;
  esac
  LINE="export PATH=\"$BIN:\$PATH\""
  if ! grep -qsF "$LINE" "$PROFILE"; then
    printf '\n# AnyDock\n%s\n' "$LINE" >> "$PROFILE"
    say "Added $BIN to PATH in $PROFILE (open a new terminal, or run: $LINE)"
  fi
fi

say "AnyDock $("$BIN/anydock" version) installed at $BIN/anydock"

if [ -n "${ANYDOCK_NO_SETUP:-}" ]; then
  say "Next: anydock setup   (sign in, connect Claude Code + Codex, background sync)"
  exit 0
fi
say ""
exec "$BIN/anydock" setup
