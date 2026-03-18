import { readdir, copyFile, stat, mkdir, readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import * as p from '@clack/prompts';
import chalk from 'chalk';

const BACKUPS_DIR = `${process.env.HOME}/.claude/statuscraft-backups`;

function handleCancel(value) {
  if (p.isCancel(value)) {
    p.cancel('Operation cancelled.');
    process.exit(0);
  }
  return value;
}

/** Ensures the backups directory exists. */
async function ensureDir() {
  await mkdir(BACKUPS_DIR, { recursive: true });
}

/**
 * Lists all saved backups with metadata.
 * @returns {Array<{name: string, path: string, date: Date}>}
 */
export async function listBackups() {
  await ensureDir();
  let files;
  try {
    files = await readdir(BACKUPS_DIR);
  } catch {
    return [];
  }

  const backups = [];
  for (const file of files) {
    if (!file.endsWith('.sh')) continue;
    const fullPath = join(BACKUPS_DIR, file);
    const info = await stat(fullPath);
    backups.push({
      name: basename(file, '.sh'),
      path: fullPath,
      date: info.mtime,
    });
  }

  backups.sort((a, b) => b.date - a.date);
  return backups;
}

/**
 * Saves a backup of the current statusline script.
 * @param {string} scriptPath - path to the current statusline.sh
 */
export async function backupFlow(scriptPath) {
  // Check if current script exists
  try {
    await stat(scriptPath);
  } catch {
    p.log.warn(chalk.yellow(`No statusline script found at ${scriptPath}`));
    return;
  }

  const backups = await listBackups();
  const existingNames = new Set(backups.map((b) => b.name));

  const now = new Date();
  const defaultName = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;

  const name = handleCancel(
    await p.text({
      message: `Name for this backup — ${chalk.dim(`enter for ${defaultName}`)}:`,
      validate(value) {
        const v = value?.trim();
        if (v && !/^[\w\-. ]+$/.test(v))
          return 'Use only letters, numbers, dashes, dots, or spaces';
        const resolved = v || defaultName;
        if (existingNames.has(resolved))
          return `"${resolved}" already exists — choose another name`;
      },
    })
  );

  const cleanName = (name || '').trim() || defaultName;
  const destPath = join(BACKUPS_DIR, `${cleanName}.sh`);

  await ensureDir();
  await copyFile(scriptPath, destPath);

  p.log.success(
    `Backup ${chalk.green(cleanName)} saved to ${chalk.dim(destPath)}`
  );
}

/**
 * Interactive restore flow — pick a backup and overwrite the current script.
 * @param {string} scriptPath - path to restore to
 */
export async function restoreFlow(scriptPath) {
  const backups = await listBackups();

  if (backups.length === 0) {
    p.log.warn(chalk.yellow('No backups found.'));
    return;
  }

  const fmt = new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const selected = handleCancel(
    await p.select({
      message: 'Select a backup to restore:',
      options: backups.map((b) => ({
        value: b.path,
        label: b.name,
        hint: fmt.format(b.date),
      })),
    })
  );

  // Show preview of the backup
  const preview = handleCancel(
    await p.confirm({
      message: 'Preview the backup script before restoring?',
      initialValue: false,
    })
  );

  if (preview) {
    const content = await readFile(selected, 'utf-8');
    console.log('\n' + chalk.dim('─'.repeat(60)));
    console.log(content);
    console.log(chalk.dim('─'.repeat(60)) + '\n');
  }

  const confirm = handleCancel(
    await p.confirm({
      message: `Restore to ${chalk.cyan(scriptPath)}? This will overwrite the current script.`,
      initialValue: true,
    })
  );

  if (!confirm) {
    p.log.info('Restore cancelled.');
    return;
  }

  await copyFile(selected, scriptPath);

  p.log.success(`Restored from backup to ${chalk.green(scriptPath)}`);
  p.note('Restart Claude Code to see the changes.', 'Done');
}

/**
 * Interactive flow to manage backups (list / delete).
 */
export async function manageBackupsFlow() {
  const backups = await listBackups();

  if (backups.length === 0) {
    p.log.warn(chalk.yellow('No backups found.'));
    return;
  }

  const fmt = new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  p.log.info(chalk.bold('Saved backups:'));
  for (const b of backups) {
    p.log.message(`  ${chalk.cyan(b.name)}  ${chalk.dim(fmt.format(b.date))}`);
  }
}
