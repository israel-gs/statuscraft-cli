#!/usr/bin/env node

import * as p from '@clack/prompts';
import chalk from 'chalk';
import { readFile, access, stat } from 'node:fs/promises';
import items, { ANSI_COLORS } from './items.js';
import { generatePreview, writeFiles, generateScript } from './generator.js';
import { backupFlow, restoreFlow, manageBackupsFlow, listBackups } from './backups.js';
import { multiselectWithPreview, selectWithPreview } from './custom-prompts.js';

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
    await multiselectWithPreview({
      message: 'Select the items for your statusline:',
      options: items.map((item) => ({
        value: item.id,
        label: `${item.emoji} ${item.name}`,
        hint: item.description,
      })),
      initialValues: DEFAULT_SELECTED,
      required: true,
      getConfigForPreview: (values) => {
        const previewItems = values
          .map((id) => items.find((i) => i.id === id))
          .filter(Boolean)
          .map((item) => ({
            item,
            cfg: {
              color: item.defaultColor,
              label: '',
              autoColor: item.supportsAutoColor ? true : false,
              mode: item.defaultMode || null,
            },
          }));
        return { items: previewItems, separator: '│' };
      },
    })
  );

  if (selectedIds.length === 0) {
    p.cancel('You must select at least one item.');
    process.exit(1);
  }

  const selectedItems = selectedIds.map((id) => items.find((i) => i.id === id));

  // ── Step 2: Configure each item ───────────────────────────────────────
  p.log.step(chalk.bold('Configure each item:'));

  const itemConfigs = selectedItems.map((item) => ({
    item,
    cfg: {
      color: item.defaultColor,
      label: '',
      autoColor: item.supportsAutoColor ? true : false,
      mode: item.defaultMode || null,
    },
  }));

  const showLivePreview = (msg = 'Live Preview', customConfigs = itemConfigs, sep = '│') => {
    p.note(generatePreview({ items: customConfigs, separator: sep }), msg);
  };

  for (let i = 0; i < selectedItems.length; i++) {
    const item = selectedItems[i];
    const cfg = itemConfigs[i].cfg;

    cfg.color = handleCancel(
      await selectWithPreview({
        message: `Color for ${item.name}:`,
        options: ANSI_COLORS.map((c) => ({
          value: c.value,
          label: c.label,
        })),
        initialValue: cfg.color,
        getConfigForPreview: (colorValue) => {
          // Temporarily apply color
          const tempCfg = { ...cfg, color: colorValue };
          const idx = itemConfigs.findIndex((ic) => ic.item.id === item.id);
          const previewConfigs = [...itemConfigs];
          previewConfigs[idx] = { item, cfg: tempCfg };
          return { items: previewConfigs, separator: '│' };
        },
      })
    );

    cfg.label = handleCancel(
      await p.text({
        message: `Custom label/prefix — enter for none (e.g. "Model:"):`,
        defaultValue: cfg.label,
      })
    );

    if (item.supportsAutoColor) {
      cfg.autoColor = handleCancel(
        await p.confirm({
          message: `Enable auto-color? (green < 40%, yellow < 70%, red >= 70%)`,
          initialValue: cfg.autoColor,
        })
      );
    }

    if (item.modes) {
      cfg.mode = handleCancel(
        await selectWithPreview({
          message: `Display mode for ${item.name}:`,
          options: item.modes.map((m) => ({
            value: m.value,
            label: m.label,
            hint: m.hint,
          })),
          initialValue: cfg.mode,
          getConfigForPreview: (modeValue) => {
            const tempCfg = { ...cfg, mode: modeValue };
            const idx = itemConfigs.findIndex((ic) => ic.item.id === item.id);
            const previewConfigs = [...itemConfigs];
            previewConfigs[idx] = { item, cfg: tempCfg };
            return { items: previewConfigs, separator: '│' };
          },
        })
      );
    }
  }

  // ── Step 3: Order items ───────────────────────────────────────────────
  const orderedIds = handleCancel(
    await multiselectWithPreview({
      message:
        'Set the display order (items appear in the order you select them):',
      options: itemConfigs.map(({ item }) => ({
        value: item.id,
        label: `${item.emoji} ${item.name}`,
      })),
      initialValues: itemConfigs.map(({ item }) => item.id),
      required: true,
      getConfigForPreview: (values) => {
        const previewConfigs = values
          .map((id) => itemConfigs.find(({ item }) => item.id === id))
          .filter(Boolean);
        return { items: previewConfigs, separator: '│' };
      },
    })
  );

  const orderedConfigs = orderedIds.map((id) =>
    itemConfigs.find(({ item }) => item.id === id)
  );

  // ── Step 4: Separator ─────────────────────────────────────────────────
  const separator = handleCancel(
    await selectWithPreview({
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
      getConfigForPreview: (sepValue) => {
        return { items: orderedConfigs, separator: sepValue };
      },
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
