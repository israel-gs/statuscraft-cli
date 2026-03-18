#!/usr/bin/env node

import * as p from '@clack/prompts';
import chalk from 'chalk';
import { readFile, access, stat } from 'node:fs/promises';
import items, { ANSI_COLORS } from './items.js';
import { generatePreview, writeFiles, generateScript } from './generator.js';
import { backupFlow, restoreFlow, manageBackupsFlow, listBackups } from './backups.js';

const DEFAULT_SCRIPT_PATH = `${process.env.HOME}/.claude/statusline.sh`;
const DEFAULT_SELECTED = ['model', 'context_pct', 'git_branch'];

function handleCancel(value) {
  if (p.isCancel(value)) {
    p.cancel('Operation cancelled.');
    process.exit(0);
  }
  return value;
}

async function createFlow() {
  // ── Recommend backup if a script already exists ───────────────────────
  let hasExistingScript = false;
  try {
    await stat(DEFAULT_SCRIPT_PATH);
    hasExistingScript = true;
  } catch {
    // no existing script
  }

  if (hasExistingScript) {
    p.log.warn(
      chalk.yellow('An existing statusline.sh was found. Consider creating a backup before continuing.')
    );
    const wantsBackup = handleCancel(
      await p.confirm({
        message: 'Create a backup now?',
        initialValue: true,
      })
    );
    if (wantsBackup) {
      await backupFlow(DEFAULT_SCRIPT_PATH);
    }
  }

  // ── Step 1: Select items ──────────────────────────────────────────────
  const selectedIds = handleCancel(
    await p.multiselect({
      message: 'Select the items for your statusline:',
      options: items.map((item) => ({
        value: item.id,
        label: `${item.emoji} ${item.name}`,
        hint: item.description,
      })),
      initialValues: DEFAULT_SELECTED,
      required: true,
    })
  );

  if (selectedIds.length === 0) {
    p.cancel('You must select at least one item.');
    process.exit(1);
  }

  const selectedItems = selectedIds.map((id) => items.find((i) => i.id === id));

  // ── Step 2: Configure each item ───────────────────────────────────────
  p.log.step(chalk.bold('Configure each item:'));

  const itemConfigs = [];

  for (const item of selectedItems) {
    p.log.info(chalk.cyan(`${item.emoji} ${item.name}`));

    const color = handleCancel(
      await p.select({
        message: `Color for ${item.name}:`,
        options: ANSI_COLORS.map((c) => ({
          value: c.value,
          label: c.label,
        })),
        initialValue: item.defaultColor,
      })
    );

    const label = handleCancel(
      await p.text({
        message: `Custom label/prefix — enter for none (e.g. "Model:"):`,
        defaultValue: '',
      })
    );

    let autoColor = false;
    if (item.supportsAutoColor) {
      autoColor = handleCancel(
        await p.confirm({
          message: `Enable auto-color? (green < 40%, yellow < 70%, red >= 70%)`,
          initialValue: true,
        })
      );
    }

    let mode = null;
    if (item.modes) {
      mode = handleCancel(
        await p.select({
          message: `Display mode for ${item.name}:`,
          options: item.modes.map((m) => ({
            value: m.value,
            label: m.label,
            hint: m.hint,
          })),
          initialValue: item.defaultMode,
        })
      );
    }

    itemConfigs.push({
      item,
      cfg: { color, label: label || '', autoColor, mode },
    });
  }

  // ── Step 3: Order items ───────────────────────────────────────────────
  const orderedIds = handleCancel(
    await p.multiselect({
      message:
        'Set the display order (items appear in the order you select them):',
      options: itemConfigs.map(({ item }) => ({
        value: item.id,
        label: `${item.emoji} ${item.name}`,
      })),
      initialValues: itemConfigs.map(({ item }) => item.id),
      required: true,
    })
  );

  const orderedConfigs = orderedIds.map((id) =>
    itemConfigs.find(({ item }) => item.id === id)
  );

  // ── Step 4: Separator ─────────────────────────────────────────────────
  const separator = handleCancel(
    await p.select({
      message: 'Choose a separator between items:',
      options: [
        { value: '│', label: '│  Pipe (thin)' },
        { value: '•', label: '•  Bullet' },
        { value: '›', label: '›  Chevron' },
        { value: '|', label: '|  Pipe' },
        { value: '—', label: '—  Dash' },
        { value: '::', label: ':: Double colon' },
        { value: ' ', label: '   Double space' },
      ],
    })
  );

  // ── Step 5: Script path ───────────────────────────────────────────────
  const scriptPath = handleCancel(
    await p.text({
      message: 'Path for the generated bash script:',
      defaultValue: DEFAULT_SCRIPT_PATH,
      validate(value) {
        if (!value) return 'Path is required';
        if (!value.startsWith('/') && !value.startsWith('~'))
          return 'Must be an absolute path';
      },
    })
  );

  const resolvedPath = scriptPath.replace(/^~/, process.env.HOME);

  const config = {
    items: orderedConfigs,
    separator,
    scriptPath: resolvedPath,
  };

  // ── Step 6: Preview + confirmation ────────────────────────────────────
  const preview = generatePreview(config);
  p.note(preview, 'Preview');

  const shouldSave = handleCancel(
    await p.confirm({
      message: 'Save this configuration?',
      initialValue: true,
    })
  );

  if (!shouldSave) {
    p.cancel('Configuration discarded.');
    process.exit(0);
  }

  // ── Step 7: Save ──────────────────────────────────────────────────────
  const s = p.spinner();
  s.start('Writing files...');

  try {
    const result = await writeFiles(config);
    s.stop('Files written successfully!');

    p.log.success(`Script: ${chalk.green(result.scriptPath)}`);
    p.log.success(`Settings: ${chalk.green(result.settingsPath)}`);

    const showScript = handleCancel(
      await p.confirm({
        message: 'Print the generated script?',
        initialValue: false,
      })
    );

    if (showScript) {
      const script = generateScript(config);
      console.log('\n' + chalk.dim('─'.repeat(60)));
      console.log(script);
      console.log(chalk.dim('─'.repeat(60)) + '\n');
    }

    p.note('Restart Claude Code to see the changes.', 'Done');
  } catch (err) {
    s.stop('Error writing files.');
    p.log.error(chalk.red(`Failed to write files: ${err.message}`));
    process.exit(1);
  }
}

async function main() {
  p.intro(chalk.bgCyan.black(' statuscraft '));

  const action = handleCancel(
    await p.select({
      message: 'What would you like to do?',
      options: [
        { value: 'create', label: 'Create new statusline', hint: 'configure from scratch' },
        { value: 'backup', label: 'Backup current statusline', hint: 'save with a name' },
        { value: 'restore', label: 'Restore from backup', hint: 'load a saved config' },
        { value: 'list', label: 'List backups', hint: 'see all saved backups' },
      ],
    })
  );

  switch (action) {
    case 'create':
      await createFlow();
      break;
    case 'backup':
      await backupFlow(DEFAULT_SCRIPT_PATH);
      break;
    case 'restore':
      await restoreFlow(DEFAULT_SCRIPT_PATH);
      break;
    case 'list':
      await manageBackupsFlow();
      break;
  }

  p.outro(chalk.dim('Made with statuscraft'));
}

main().catch((err) => {
  p.log.error(err.message);
  process.exit(1);
});
