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

# Node.js 22+ (Claude Code and Codex users almost always have it already).
NODE="$(command -v node || true)"
[ -n "$NODE" ] || fail "Node.js 22 or newer is required. Install it from https://nodejs.org (or: brew install node) and re-run."
MAJOR="$("$NODE" -p 'process.versions.node.split(".")[0]')"
[ "$MAJOR" -ge 22 ] || fail "Node.js 22 or newer is required (found $("$NODE" -v)). Upgrade Node and re-run."

say "Installing AnyDock from $SERVER …"
mkdir -p "$BIN"
TMP="$BIN/anydock.mjs.download"
curl -fsSL "$SERVER/cli/anydock.mjs" -o "$TMP" || fail "could not download $SERVER/cli/anydock.mjs"
EXPECTED="$(curl -fsSL "$SERVER/cli/version.json" | "$NODE" -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).sha256))')"
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
  grep -qsF "$LINE" "$PROFILE" || printf '\n# AnyDock\n%s\n' "$LINE" >> "$PROFILE"
  say "Added $BIN to PATH in $PROFILE (open a new terminal, or run: $LINE)"
fi

say "AnyDock $("$BIN/anydock" version) installed at $BIN/anydock"

if [ -n "${ANYDOCK_NO_SETUP:-}" ]; then
  say "Next: anydock setup   (sign in, connect Claude Code + Codex, background sync)"
  exit 0
fi
say ""
exec "$BIN/anydock" setup
