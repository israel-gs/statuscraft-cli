#!/usr/bin/env node

import * as p from '@clack/prompts';
import chalk from 'chalk';
import { readFile, access, stat } from 'node:fs/promises';
import items, { ANSI_COLORS } from './items.js';
import { generatePreview, writeFiles, generateScript, loadSavedConfig } from './generator.js';
import { backupFlow, restoreFlow, manageBackupsFlow, listBackups } from './backups.js';
import { multiselectWithPreview, selectWithPreview, reorderPrompt } from './custom-prompts.js';
import themes from './themes.js';

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

  const itemConfigs = selectedItems.map((item) => ({
    item,
    cfg: {
      color: item.defaultColor,
      label: '',
      autoColor: item.supportsAutoColor ? true : false,
      mode: item.defaultMode || null,
    },
  }));

  await configureAndSave(itemConfigs, { skipConfigure: false, separator: '│' });
}

/**
 * Shared configuration wizard — used by create, theme, and edit flows.
 * Takes pre-populated itemConfigs and runs steps 2–7.
 * @param {Array} itemConfigs - [{item, cfg}]
 * @param {object} opts - { skipConfigure: boolean, separator: string }
 */
async function configureAndSave(itemConfigs, opts = {}) {
  const { skipConfigure = false, separator: initialSeparator = '│' } = opts;

  // ── Step 2: Configure each item (unless skipping for themes) ──────
  if (!skipConfigure) {
    p.log.step(chalk.bold('Configure each item:'));

    for (let i = 0; i < itemConfigs.length; i++) {
      const { item } = itemConfigs[i];
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
            const tempCfg = { ...cfg, color: colorValue };
            const idx = itemConfigs.findIndex((ic) => ic.item.id === item.id);
            const previewConfigs = [...itemConfigs];
            previewConfigs[idx] = { item, cfg: tempCfg };
            return { items: previewConfigs, separator: initialSeparator };
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
            initialValue: cfg.mode || item.defaultMode,
            getConfigForPreview: (modeValue) => {
              const tempCfg = { ...cfg, mode: modeValue };
              const idx = itemConfigs.findIndex((ic) => ic.item.id === item.id);
              const previewConfigs = [...itemConfigs];
              previewConfigs[idx] = { item, cfg: tempCfg };
              return { items: previewConfigs, separator: initialSeparator };
            },
          })
        );
      }
    }
  }

  // ── Step 3: Order items ─────────────────────────────────────────────
  const orderedIds = handleCancel(
    await reorderPrompt({
      message: 'Reorder your statusline items:',
      options: itemConfigs.map(({ item }) => ({
        value: item.id,
        label: `${item.emoji} ${item.name}`,
      })),
      initialOrder: itemConfigs.map(({ item }) => item.id),
      getConfigForPreview: (order) => {
        const previewConfigs = order
          .map((id) => itemConfigs.find(({ item }) => item.id === id))
          .filter(Boolean);
        return { items: previewConfigs, separator: initialSeparator };
      },
    })
  );

  const orderedConfigs = orderedIds.map((id) =>
    itemConfigs.find(({ item }) => item.id === id)
  );

  // ── Step 4: Separator ───────────────────────────────────────────────
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
      initialValue: initialSeparator,
      getConfigForPreview: (sepValue) => {
        return { items: orderedConfigs, separator: sepValue };
      },
    })
  );

  // ── Step 5: Script path ─────────────────────────────────────────────
  const scriptPath = handleCancel(
    await p.text({
      message: 'Path for the generated bash script:',
      initialValue: DEFAULT_SCRIPT_PATH,
      validate(value) {
        const v = value || DEFAULT_SCRIPT_PATH;
        if (!v) return 'Path is required';
        if (!v.startsWith('/') && !v.startsWith('~'))
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

  // ── Step 6: Preview + confirmation ──────────────────────────────────
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

  // ── Step 7: Save ────────────────────────────────────────────────────
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

async function themeFlow() {
  // Show theme selector with preview
  const themeId = handleCancel(
    await selectWithPreview({
      message: 'Choose a theme:',
      options: themes.map((t) => ({
        value: t.id,
        label: `${t.emoji} ${t.name}`,
        hint: t.description,
      })),
      getConfigForPreview: (id) => {
        const theme = themes.find((t) => t.id === id);
        if (!theme) return { items: [], separator: '│' };
        const previewItems = theme.items
          .map((ti) => {
            const item = items.find((i) => i.id === ti.id);
            if (!item) return null;
            return { item, cfg: { ...ti } };
          })
          .filter(Boolean);
        return { items: previewItems, separator: theme.separator };
      },
    })
  );

  const theme = themes.find((t) => t.id === themeId);
  const itemConfigs = theme.items
    .map((ti) => {
      const item = items.find((i) => i.id === ti.id);
      if (!item) return null;
      return { item, cfg: { ...ti } };
    })
    .filter(Boolean);

  p.log.info(`Theme: ${chalk.cyan(theme.name)} — ${theme.description}`);

  const customize = handleCancel(
    await p.confirm({
      message: 'Customize colors and labels before saving?',
      initialValue: false,
    })
  );

  await configureAndSave(itemConfigs, {
    skipConfigure: !customize,
    separator: theme.separator,
  });
}

async function editFlow() {
  const saved = await loadSavedConfig();

  if (!saved) {
    p.log.warn(chalk.yellow('No saved configuration found. Use "Create" or "Use a theme" first.'));
    return;
  }

  p.log.info(chalk.dim(`Loaded config with ${saved.items.length} widgets`));

  // Rebuild itemConfigs from saved data
  const itemConfigs = saved.items
    .map((si) => {
      const item = items.find((i) => i.id === si.id);
      if (!item) return null;
      return {
        item,
        cfg: {
          color: si.color,
          label: si.label || '',
          autoColor: si.autoColor || false,
          mode: si.mode || null,
        },
      };
    })
    .filter(Boolean);

  if (itemConfigs.length === 0) {
    p.log.warn(chalk.yellow('Saved config references unknown widgets. Starting fresh.'));
    await createFlow();
    return;
  }

  // Show current config
  const currentPreview = generatePreview({ items: itemConfigs, separator: saved.separator });
  p.note(currentPreview, 'Current statusline');

  const editAction = handleCancel(
    await p.select({
      message: 'What would you like to edit?',
      options: [
        { value: 'widgets', label: 'Add or remove widgets', hint: 'change which widgets are shown' },
        { value: 'colors', label: 'Change colors & labels', hint: 'reconfigure each widget' },
        { value: 'reorder', label: 'Reorder & separator', hint: 'change order and separator' },
        { value: 'full', label: 'Full reconfigure', hint: 'go through all steps' },
      ],
    })
  );

  if (editAction === 'widgets') {
    // Select widgets, pre-selecting current ones
    const currentIds = itemConfigs.map(({ item }) => item.id);

    const selectedIds = handleCancel(
      await multiselectWithPreview({
        message: 'Select the items for your statusline:',
        options: items.map((item) => ({
          value: item.id,
          label: `${item.emoji} ${item.name}`,
          hint: item.description,
        })),
        initialValues: currentIds,
        required: true,
        getConfigForPreview: (values) => {
          const previewItems = values
            .map((id) => {
              const existing = itemConfigs.find(({ item: it }) => it.id === id);
              if (existing) return existing;
              const found = items.find((i) => i.id === id);
              if (!found) return null;
              return {
                item: found,
                cfg: {
                  color: found.defaultColor,
                  label: '',
                  autoColor: found.supportsAutoColor,
                  mode: found.defaultMode || null,
                },
              };
            })
            .filter(Boolean);
          return { items: previewItems, separator: saved.separator };
        },
      })
    );

    // Build new itemConfigs, preserving existing configs
    const newItemConfigs = selectedIds
      .map((id) => {
        const existing = itemConfigs.find(({ item: it }) => it.id === id);
        if (existing) return existing;
        const found = items.find((i) => i.id === id);
        if (!found) return null;
        return {
          item: found,
          cfg: {
            color: found.defaultColor,
            label: '',
            autoColor: found.supportsAutoColor,
            mode: found.defaultMode || null,
          },
        };
      })
      .filter(Boolean);

    // Configure only newly added widgets
    const newIds = selectedIds.filter((id) => !currentIds.includes(id));
    if (newIds.length > 0) {
      p.log.step(chalk.bold('Configure new widgets:'));
      for (const id of newIds) {
        const entry = newItemConfigs.find(({ item }) => item.id === id);
        if (!entry) continue;
        const { item, cfg } = entry;

        cfg.color = handleCancel(
          await selectWithPreview({
            message: `Color for ${item.name}:`,
            options: ANSI_COLORS.map((c) => ({ value: c.value, label: c.label })),
            initialValue: cfg.color,
            getConfigForPreview: (colorValue) => {
              const tempCfg = { ...cfg, color: colorValue };
              const previewConfigs = newItemConfigs.map((ic) =>
                ic.item.id === id ? { item, cfg: tempCfg } : ic
              );
              return { items: previewConfigs, separator: saved.separator };
            },
          })
        );

        if (item.modes) {
          cfg.mode = handleCancel(
            await selectWithPreview({
              message: `Display mode for ${item.name}:`,
              options: item.modes.map((m) => ({
                value: m.value,
                label: m.label,
                hint: m.hint,
              })),
              initialValue: cfg.mode || item.defaultMode,
              getConfigForPreview: (modeValue) => {
                const tempCfg = { ...cfg, mode: modeValue };
                const previewConfigs = newItemConfigs.map((ic) =>
                  ic.item.id === id ? { item, cfg: tempCfg } : ic
                );
                return { items: previewConfigs, separator: saved.separator };
              },
            })
          );
        }
      }
    }

    await configureAndSave(newItemConfigs, {
      skipConfigure: true,
      separator: saved.separator,
    });
  } else if (editAction === 'colors') {
    await configureAndSave(itemConfigs, {
      skipConfigure: false,
      separator: saved.separator,
    });
  } else if (editAction === 'reorder') {
    await configureAndSave(itemConfigs, {
      skipConfigure: true,
      separator: saved.separator,
    });
  } else {
    // full reconfigure
    await configureAndSave(itemConfigs, {
      skipConfigure: false,
      separator: saved.separator,
    });
  }
}

async function main() {
  p.intro(chalk.bgCyan.black(' statuscraft '));

  // Check if a saved config exists to show edit option
  const savedConfig = await loadSavedConfig();

  const menuOptions = [
    { value: 'create', label: 'Create new statusline', hint: 'configure from scratch' },
    { value: 'theme', label: 'Use a theme', hint: 'start from a preset' },
  ];

  if (savedConfig) {
    menuOptions.push({ value: 'edit', label: 'Edit current statusline', hint: 'modify your existing config' });
  }

  menuOptions.push(
    { value: 'backup', label: 'Backup current statusline', hint: 'save with a name' },
    { value: 'restore', label: 'Restore from backup', hint: 'load a saved config' },
    { value: 'list', label: 'List backups', hint: 'see all saved backups' },
  );

  const action = handleCancel(
    await p.select({
      message: 'What would you like to do?',
      options: menuOptions,
    })
  );

  switch (action) {
    case 'create':
      await createFlow();
      break;
    case 'theme':
      await themeFlow();
      break;
    case 'edit':
      await editFlow();
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
