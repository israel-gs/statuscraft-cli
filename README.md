# statuscraft

Interactive CLI to customize the **Claude Code** statusline.

Generates a bash script (`~/.claude/statusline.sh`) and updates `~/.claude/settings.json` so Claude Code displays your personalized statusline.

## Requirements

- **Node.js** >= 18
- **jq** — used by the generated bash script to parse JSON
  ```bash
  brew install jq      # macOS
  sudo apt install jq  # Ubuntu/Debian
  ```

## Installation

```bash
# Clone or download
cd statuscraft
npm install

# Run directly
node index.js

# Or install globally
npm install -g .
statuscraft
```

## Available Items

| Item | Description | Example |
|------|-------------|---------|
| 🤖 Model Name | Current Claude model | `claude-sonnet-4-5` |
| 📊 Context % | Context window usage | `42%` |
| 📶 Context Bar | Visual progress bar | `[████░░░░░░]` |
| 🔢 Tokens | Total input tokens | `85k` |
| 💰 Cost | Session cost in USD | `$0.023` |
| 🌿 Git Branch | Current branch (⎇) | `⎇ main` |
| 📝 Git Status | Staged/Modified/Untracked | `S:2 M:1 ?:0` |
| 📁 Directory | Working directory | `my-project` |
| 🕐 Time | Current time | `14:30` |
| 🔑 Session ID | First 8 chars of session | `a1b2c3d4` |

## Features

- **Auto-color** for Context % and Context Bar: green (< 40%), yellow (< 70%), red (>= 70%)
- **Custom labels** for each item
- **Display modes** for Directory (basename/tilde/full) and Time (24h/12h/seconds)
- **12 ANSI color options** per item
- **Configurable separator** between items
- **Preview** before saving

## How it works

Claude Code sends JSON via stdin to the statusline script. The JSON has this shape:

```json
{
  "model": {
    "display_name": "claude-sonnet-4-5"
  },
  "context_window": {
    "used_percentage": 42.5
  },
  "token_usage": {
    "total_input_tokens": 85000
  },
  "cost_usd": 0.023,
  "session_id": "a1b2c3d4-e5f6-...",
  "workspace": {
    "current_dir": "/Users/you/projects/app"
  }
}
```

The generated bash script parses this JSON with `jq`, formats each selected item, and outputs a single-line string that Claude Code renders as its statusline.

## License

MIT
