# Set up AnyDock — instructions for an AI agent

You are an AI agent (Claude Code, Codex, Cursor, or similar) and the user asked you to set up AnyDock.
AnyDock lets the user share or hand over their agent sessions — context, trajectory, decisions — with teammates
and their agents. Follow these steps in order, run the commands yourself, and keep the user informed in one line per step.

## 1. Check Node.js

Run `node -v`. AnyDock needs Node.js 22 or newer. If it's missing or older, stop and ask the user to install it
(https://nodejs.org, or `brew install node` on macOS); don't install it for them without asking.

## 2. Install the CLI

```sh
curl -fsSL https://anydock.ai/install.sh | ANYDOCK_NO_SETUP=1 sh
```

This installs `~/.anydock/bin/anydock` (and adds it to PATH for new shells). Use the full path
`~/.anydock/bin/anydock` in the commands below, since your current shell may not have the new PATH yet.

## 3. Sign the user in

```sh
~/.anydock/bin/anydock login
```

It opens the user's browser and prints a URL and an 8-character code, then waits (up to 30 minutes) until the user
approves. Run it with a long timeout or in the background. **Tell the user the code and the URL** right away and ask them
to approve it in the browser. Continue when it prints `Signed in as …`. You never handle a password or token.

## 4. Connect agents

```sh
~/.anydock/bin/anydock mcp install
```

This registers the AnyDock MCP server with Claude Code and Codex if they're installed. If you are a different MCP client
(Cursor, Windsurf, VS Code, …), add a **stdio** MCP server to your own MCP config instead:

- command: the absolute path of `~/.anydock/bin/anydock` (expand `~`)
- args: `["mcp"]`

## 5. Turn on background sync

```sh
~/.anydock/bin/anydock service install
```

This keeps shared sessions syncing live (launchd on macOS, systemd user unit on Linux).

## 6. Tell the user they're done

Say, briefly:

- Restart this agent (or open a new session) to load the AnyDock tools.
- Nothing leaves the machine until they share something. Then they can just say:
  - "share this session with jason@company.com"
  - "hand this over to ashley@company.com"
  - "what did teammates send me on AnyDock?"

## If something fails

- Re-running any step is safe.
- `~/.anydock/bin/anydock setup` does steps 3–5 in one go.
- `~/.anydock/bin/anydock service status` shows whether background sync is running; its log is `~/.anydock/watch.log`.
- Don't edit `~/.anydock/config.json` by hand and don't print its contents: it holds the user's sign-in token.
