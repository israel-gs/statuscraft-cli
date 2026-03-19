// Predefined theme configurations for quick setup

const themes = [
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean & simple — just the essentials',
    emoji: '🪶',
    separator: '│',
    items: [
      { id: 'model', color: '36', label: '', autoColor: false, mode: null },
      { id: 'context_pct', color: '33', label: '', autoColor: true, mode: null },
      { id: 'cost', color: '32', label: '', autoColor: false, mode: null },
    ],
  },
  {
    id: 'developer',
    name: 'Developer',
    description: 'Full context — model, tokens, git, runtime',
    emoji: '🧑‍💻',
    separator: '│',
    items: [
      { id: 'model', color: '36', label: '', autoColor: false, mode: null },
      { id: 'context_pct', color: '33', label: '', autoColor: true, mode: null },
      { id: 'tokens', color: '35', label: '', autoColor: false, mode: null },
      { id: 'cost', color: '32', label: '', autoColor: false, mode: null },
      { id: 'git_branch', color: '36', label: '', autoColor: false, mode: null },
      { id: 'runtime_version', color: '32', label: '', autoColor: false, mode: 'auto' },
    ],
  },
  {
    id: 'git_focused',
    name: 'Git Focused',
    description: 'Everything git — branch, status, stash, ahead/behind',
    emoji: '🌿',
    separator: '•',
    items: [
      { id: 'model', color: '36', label: '', autoColor: false, mode: null },
      { id: 'git_branch', color: '36', label: '', autoColor: false, mode: null },
      { id: 'git_status', color: '33', label: '', autoColor: false, mode: null },
      { id: 'git_ahead_behind', color: '34', label: '', autoColor: false, mode: null },
      { id: 'git_stash', color: '35', label: '', autoColor: false, mode: null },
    ],
  },
  {
    id: 'full',
    name: 'Full Info',
    description: 'Maximum information — everything at a glance',
    emoji: '📊',
    separator: '│',
    items: [
      { id: 'model', color: '36', label: '', autoColor: false, mode: null },
      { id: 'context_bar', color: '36', label: '', autoColor: true, mode: null },
      { id: 'tokens', color: '35', label: '', autoColor: false, mode: null },
      { id: 'cost', color: '32', label: '', autoColor: false, mode: null },
      { id: 'git_branch', color: '36', label: '', autoColor: false, mode: null },
      { id: 'git_status', color: '33', label: '', autoColor: false, mode: null },
      { id: 'cwd', color: '34', label: '', autoColor: false, mode: 'basename' },
      { id: 'time', color: '90', label: '', autoColor: false, mode: '24h' },
    ],
  },
  {
    id: 'compact',
    name: 'Compact',
    description: 'Space-efficient with context bar and git',
    emoji: '📏',
    separator: '›',
    items: [
      { id: 'context_bar', color: '36', label: '', autoColor: true, mode: null },
      { id: 'cost', color: '32', label: '', autoColor: false, mode: null },
      { id: 'git_branch', color: '36', label: '', autoColor: false, mode: null },
    ],
  },
];

export default themes;
