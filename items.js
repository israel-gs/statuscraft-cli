// Items disponibles para el statusline de Claude Code

/** ANSI color map — code fragments for bash */
export const ANSI_COLORS = [
  { value: '36', label: '🩵 Cyan', name: 'cyan' },
  { value: '32', label: '💚 Green', name: 'green' },
  { value: '33', label: '💛 Yellow', name: 'yellow' },
  { value: '31', label: '❤️  Red', name: 'red' },
  { value: '34', label: '💙 Blue', name: 'blue' },
  { value: '35', label: '💜 Magenta', name: 'magenta' },
  { value: '37', label: '🤍 White', name: 'white' },
  { value: '90', label: '🩶 Gray', name: 'gray' },
  { value: '91', label: '🧡 Bright Red', name: 'bright_red' },
  { value: '92', label: '💚 Bright Green', name: 'bright_green' },
  { value: '93', label: '💛 Bright Yellow', name: 'bright_yellow' },
  { value: '94', label: '💙 Bright Blue', name: 'bright_blue' },
  { value: '95', label: '💜 Bright Magenta', name: 'bright_magenta' },
  { value: '96', label: '🩵 Bright Cyan', name: 'bright_cyan' },
];

/**
 * Wraps bash content in ANSI color using $'\033' (ANSI-C quoting).
 * Content is placed inside double quotes so variable expansion works safely.
 * @param {string} content - bash content (variables, command subs — NO outer quotes)
 * @param {string} code - ANSI color code (e.g. '36')
 */
function c(content, code) {
  return `$'\\033[01;${code}m'"${content}"$'\\033[0m'`;
}

/**
 * Generates bash auto-color block for percentage-based items.
 * Expects `_pct` to be set before this runs.
 */
function autoColorBlock(varName, content, fallbackColor, cfg) {
  if (cfg.autoColor) {
    return `if [ "$_pct" -lt 40 ] 2>/dev/null; then
    ${varName}=${c(content, '32')}
  elif [ "$_pct" -lt 70 ] 2>/dev/null; then
    ${varName}=${c(content, '33')}
  else
    ${varName}=${c(content, '31')}
  fi`;
  }
  return `${varName}=${c(content, fallbackColor)}`;
}

/** Build label prefix for bash content (no quotes — goes inside double-quoted context) */
function lbl(cfg) {
  return cfg.label ? cfg.label + ' ' : '';
}

/** All available statusline items */
const items = [
  {
    id: 'model',
    name: 'Model Name',
    description: 'Current Claude model display name',
    emoji: '🤖',
    defaultColor: '36',
    varName: 'model_out',
    supportsAutoColor: false,
    modes: null,
    exampleValue: 'claude-sonnet-4-5',
    generateBash(cfg) {
      return `model_val=$(echo "$input" | jq -r '.model.display_name // empty')
if [ -n "$model_val" ]; then
  model_out=${c(`${lbl(cfg)}$model_val`, cfg.color)}
fi`;
    },
  },
  {
    id: 'context_pct',
    name: 'Context %',
    description: 'Context window usage percentage',
    emoji: '📊',
    defaultColor: '33',
    varName: 'ctx_pct_out',
    supportsAutoColor: true,
    modes: null,
    exampleValue: '42%',
    generateBash(cfg) {
      return `_pct=$(echo "$input" | jq -r '.context_window.used_percentage // empty' | cut -d. -f1)
if [ -n "$_pct" ]; then
  _display="${lbl(cfg)}\${_pct}%"
  ${autoColorBlock('ctx_pct_out', '$_display', cfg.color, cfg)}
fi`;
    },
  },
  {
    id: 'context_bar',
    name: 'Context Bar',
    description: 'Visual progress bar [████░░░░░░]',
    emoji: '📶',
    defaultColor: '36',
    varName: 'ctx_bar_out',
    supportsAutoColor: true,
    modes: null,
    exampleValue: '[████░░░░░░]',
    generateBash(cfg) {
      return `_pct=$(echo "$input" | jq -r '.context_window.used_percentage // empty' | cut -d. -f1)
if [ -n "$_pct" ]; then
  _filled=$(( _pct / 10 ))
  _empty=$(( 10 - _filled ))
  _bar="["
  for ((i=0; i<_filled; i++)); do _bar+="█"; done
  for ((i=0; i<_empty; i++)); do _bar+="░"; done
  _bar+="]"
  _display="${lbl(cfg)}\${_bar}"
  ${autoColorBlock('ctx_bar_out', '$_display', cfg.color, cfg)}
fi`;
    },
  },
  {
    id: 'tokens',
    name: 'Tokens',
    description: 'Total input tokens (formatted as 85k)',
    emoji: '🔢',
    defaultColor: '35',
    varName: 'tokens_out',
    supportsAutoColor: false,
    modes: null,
    exampleValue: '85k',
    generateBash(cfg) {
      return `_tokens=$(echo "$input" | jq -r '.token_usage.total_input_tokens // empty')
if [ -n "$_tokens" ]; then
  if [ "$_tokens" -ge 1000000 ] 2>/dev/null; then
    _fmt="$(( _tokens / 1000000 ))M"
  elif [ "$_tokens" -ge 1000 ] 2>/dev/null; then
    _fmt="$(( _tokens / 1000 ))k"
  else
    _fmt="$_tokens"
  fi
  tokens_out=${c(`${lbl(cfg)}$_fmt`, cfg.color)}
fi`;
    },
  },
  {
    id: 'cost',
    name: 'Cost',
    description: 'Session cost in USD',
    emoji: '💰',
    defaultColor: '32',
    varName: 'cost_out',
    supportsAutoColor: false,
    modes: null,
    exampleValue: '$0.023',
    generateBash(cfg) {
      return `_cost=$(echo "$input" | jq -r '.cost_usd // empty')
if [ -n "$_cost" ]; then
  cost_out=${c(`${lbl(cfg)}\\$$_cost`, cfg.color)}
fi`;
    },
  },
  {
    id: 'git_branch',
    name: 'Git Branch',
    description: 'Current git branch with ⎇ icon',
    emoji: '🌿',
    defaultColor: '36',
    varName: 'branch_out',
    supportsAutoColor: false,
    modes: null,
    exampleValue: 'main',
    generateBash(cfg) {
      const prefix = cfg.label ? cfg.label + ' ' : '⎇ ';
      return `_branch=$(cd "$cwd" 2>/dev/null && git rev-parse --abbrev-ref HEAD 2>/dev/null)
if [ -n "$_branch" ]; then
  branch_out=${c(`${prefix}$_branch`, cfg.color)}
fi`;
    },
  },
  {
    id: 'git_status',
    name: 'Git Status',
    description: 'Staged/Modified/Untracked counts',
    emoji: '📝',
    defaultColor: '33',
    varName: 'gstatus_out',
    supportsAutoColor: false,
    modes: null,
    exampleValue: 'S:2 M:1 ?:0',
    generateBash(cfg) {
      return `if cd "$cwd" 2>/dev/null && git rev-parse --is-inside-work-tree &>/dev/null; then
  _staged=$(cd "$cwd" && git diff --cached --numstat 2>/dev/null | wc -l | tr -d ' ')
  _modified=$(cd "$cwd" && git diff --numstat 2>/dev/null | wc -l | tr -d ' ')
  _untracked=$(cd "$cwd" && git ls-files --others --exclude-standard 2>/dev/null | wc -l | tr -d ' ')
  gstatus_out=${c(`${lbl(cfg)}S:$_staged M:$_modified ?:$_untracked`, cfg.color)}
fi`;
    },
  },
  {
    id: 'cwd',
    name: 'Directory',
    description: 'Current working directory',
    emoji: '📁',
    defaultColor: '34',
    varName: 'cwd_out',
    supportsAutoColor: false,
    modes: [
      { value: 'basename', label: 'Basename only', hint: 'project-name' },
      { value: 'tilde', label: 'With ~ for home', hint: '~/projects/app' },
      { value: 'full', label: 'Full path', hint: '/Users/you/projects/app' },
    ],
    defaultMode: 'basename',
    exampleValues: { basename: 'my-project', tilde: '~/projects/my-project', full: '/Users/you/projects/my-project' },
    exampleValue: 'my-project',
    generateBash(cfg) {
      const mode = cfg.mode || 'basename';
      let dirExpr;
      if (mode === 'basename') {
        dirExpr = '$(basename "$cwd")';
      } else if (mode === 'tilde') {
        dirExpr = '$(echo "$cwd" | sed "s|^$HOME|~|")';
      } else {
        dirExpr = '$cwd';
      }
      return `if [ -n "$cwd" ]; then
  cwd_out=${c(`${lbl(cfg)}${dirExpr}`, cfg.color)}
fi`;
    },
  },
  {
    id: 'time',
    name: 'Time',
    description: 'Current time',
    emoji: '🕐',
    defaultColor: '90',
    varName: 'time_out',
    supportsAutoColor: false,
    modes: [
      { value: '24h', label: '24-hour', hint: '14:30' },
      { value: '12h', label: '12-hour', hint: '2:30 PM' },
      { value: 'seconds', label: 'With seconds', hint: '14:30:05' },
    ],
    defaultMode: '24h',
    exampleValues: { '24h': '14:30', '12h': '2:30 PM', seconds: '14:30:05' },
    exampleValue: '14:30',
    generateBash(cfg) {
      const mode = cfg.mode || '24h';
      let fmt;
      if (mode === '24h') fmt = '%H:%M';
      else if (mode === '12h') fmt = '%I:%M %p';
      else fmt = '%H:%M:%S';
      return `time_out=${c(`${lbl(cfg)}$(date +'${fmt}')`, cfg.color)}`;
    },
  },
  {
    id: 'session_id',
    name: 'Session ID',
    description: 'First 8 chars of session ID',
    emoji: '🔑',
    defaultColor: '90',
    varName: 'session_out',
    supportsAutoColor: false,
    modes: null,
    exampleValue: 'a1b2c3d4',
    generateBash(cfg) {
      return `_sid=$(echo "$input" | jq -r '.session_id // empty')
if [ -n "$_sid" ]; then
  _short=$(echo "$_sid" | cut -c1-8)
  session_out=${c(`${lbl(cfg)}$_short`, cfg.color)}
fi`;
    },
  },
];

export default items;
