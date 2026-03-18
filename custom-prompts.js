import { MultiSelectPrompt, SelectPrompt, Prompt } from '@clack/core';
import chalk from 'chalk';
import { stripVTControlCharacters } from 'node:util';
import { generatePreview } from './generator.js';

// Basic symbols used by clack defaults for a cohesive UI
const S_BAR = '│';
const S_BAR_END = '└';
const S_STEP_ACTIVE = '◆';
const S_STEP_CANCEL = '■';
const S_STEP_SUBMIT = '◇';
const S_CHECKBOX_SELECTED = '◉';
const S_CHECKBOX_INACTIVE = '◯';

export async function multiselectWithPreview(opts) {
  return new MultiSelectPrompt({
    options: opts.options,
    initialValues: opts.initialValues || [],
    required: opts.required ?? true,
    validate(val) {
      if (opts.required && val.length === 0) {
        return `Please select at least one option.\n${chalk.dim('Press space to select, enter to submit')}`;
      }
    },
    render() {
      let titleColor = chalk.cyan(S_STEP_ACTIVE);
      if (this.state === 'submit') titleColor = chalk.green(S_STEP_SUBMIT);
      else if (this.state === 'cancel') titleColor = chalk.red(S_STEP_CANCEL);
      else if (this.state === 'error') titleColor = chalk.yellow(S_STEP_ACTIVE);

      let out = `${chalk.gray(S_BAR)}\n${titleColor}  ${opts.message}\n`;

      if (this.state === 'submit') {
        const labels = this.options.filter(o => this.value.includes(o.value)).map(o => o.label || o.value);
        out += `${chalk.gray(S_BAR)}  ${chalk.dim(labels.join(', ') || 'none')}`;
        return out;
      }

      if (this.state === 'cancel') {
        const labels = this.options.filter(o => this.value.includes(o.value)).map(o => o.label || o.value);
        out += `${chalk.gray(S_BAR)}  ${chalk.strikethrough(chalk.dim(labels.join(', ') || 'none'))}`;
        return out;
      }

      const barColor = this.state === 'error' ? chalk.yellow(S_BAR) : chalk.cyan(S_BAR);

      // Draw the options list
      const optionsList = this.options.map((opt, i) => {
        const isSelected = this.value.includes(opt.value);
        const isActive = i === this.cursor; // currently highlighted
        
        let prefix = isSelected ? chalk.green(S_CHECKBOX_SELECTED) : chalk.dim(S_CHECKBOX_INACTIVE);
        let label = opt.label || opt.value;
        
        if (isActive && isSelected) {
          prefix = chalk.green(S_CHECKBOX_SELECTED);
          label = chalk.bold(label);
        } else if (isActive && !isSelected) {
          prefix = chalk.cyan(S_CHECKBOX_INACTIVE);
          label = chalk.bold(label);
        } else if (isSelected) {
          label = chalk.dim(label);
        } else {
          label = chalk.dim(label);
        }
        
        return `${barColor}  ${prefix} ${label}`;
      }).join('\n');
      
      out += optionsList + '\n';
      
      // Draw the live preview inside the prompt
      const selectedValues = this.value;
      const configForPreview = opts.getConfigForPreview(selectedValues);
      
      if (configForPreview && configForPreview.items.length > 0) {
        const previewStr = generatePreview(configForPreview);
        const visualWidth = stripVTControlCharacters(previewStr).length;
        const title = 'Live Preview';
        const boxWidth = Math.max(visualWidth + 2, title.length + 4);
        
        out += `${barColor}\n`;
        out += `${barColor}  ${chalk.dim(title)} ${chalk.gray('─'.repeat(boxWidth - title.length - 1) + '╮')}\n`;
        out += `${barColor}  ${previewStr}${chalk.gray(' '.repeat(boxWidth - visualWidth) + '│')}\n`;
        out += `${barColor}  ${chalk.gray('─'.repeat(boxWidth) + '╯')}\n`;
      } else {
        out += `${barColor}\n`;
      }

      if (this.state === 'error') {
         out += `${chalk.yellow('▲')}  ${chalk.yellow(this.error)}\n`;
      } else {
         out += chalk.cyan('└');
      }
      
      return out;
    }
  }).prompt();
}

const S_RADIO_ACTIVE = '●';
const S_RADIO_INACTIVE = '○';

export async function selectWithPreview(opts) {
  return new SelectPrompt({
    options: opts.options,
    initialValue: opts.initialValue,
    render() {
      let titleColor = chalk.cyan(S_STEP_ACTIVE);
      if (this.state === 'submit') titleColor = chalk.green(S_STEP_SUBMIT);
      else if (this.state === 'cancel') titleColor = chalk.red(S_STEP_CANCEL);
      else if (this.state === 'error') titleColor = chalk.yellow(S_STEP_ACTIVE);

      let out = `${chalk.gray(S_BAR)}\n${titleColor}  ${opts.message}\n`;

      if (this.state === 'submit') {
        const selected = this.options[this.cursor];
        const label = selected.label || selected.value;
        out += `${chalk.gray(S_BAR)}  ${chalk.dim(label)}`;
        return out;
      }

      if (this.state === 'cancel') {
        const selected = this.options[this.cursor];
        const label = selected.label || selected.value;
        out += `${chalk.gray(S_BAR)}  ${chalk.strikethrough(chalk.dim(label))}`;
        return out;
      }

      const barColor = this.state === 'error' ? chalk.yellow(S_BAR) : chalk.cyan(S_BAR);

      // Draw the options list
      const optionsList = this.options.map((opt, i) => {
        const isActive = i === this.cursor; // currently highlighted
        
        let prefix = chalk.dim(S_RADIO_INACTIVE);
        let label = opt.label || opt.value;
        
        if (isActive) {
          prefix = chalk.green(S_RADIO_ACTIVE);
          label = chalk.bold(label);
        } else {
          label = chalk.dim(label);
        }
        
        return `${barColor}  ${prefix} ${label}`;
      }).join('\n');
      
      out += optionsList + '\n';
      
      // Draw the live preview inside the prompt
      const selectedValue = this.options[this.cursor].value;
      const configForPreview = opts.getConfigForPreview(selectedValue);
      
      if (configForPreview && configForPreview.items.length > 0) {
        const previewStr = generatePreview(configForPreview);
        const visualWidth = stripVTControlCharacters(previewStr).length;
        const title = 'Live Preview';
        const boxWidth = Math.max(visualWidth + 2, title.length + 4);
        
        out += `${barColor}\n`;
        out += `${barColor}  ${chalk.dim(title)} ${chalk.gray('─'.repeat(boxWidth - title.length - 1) + '╮')}\n`;
        out += `${barColor}  ${previewStr}${chalk.gray(' '.repeat(boxWidth - visualWidth) + '│')}\n`;
        out += `${barColor}  ${chalk.gray('─'.repeat(boxWidth) + '╯')}\n`;
      } else {
        out += `${barColor}\n`;
      }

      if (this.state === 'error') {
         out += `${chalk.yellow('▲')}  ${chalk.yellow(this.error)}\n`;
      } else {
         out += chalk.cyan('└');
      }
      
      return out;
    }
  }).prompt();
}

/**
 * Reorder prompt — raw readline-based.
 * ↑/↓    — navigate cursor
 * Space  — grab/release item (when grabbed, ↑/↓ also moves the item)
 * Enter  — confirm
 * Ctrl+C / Esc — cancel
 */
export async function reorderPrompt(opts) {
  let order = [...opts.initialOrder];
  let cursor = 0;
  let grabbed = false;
  let linesWritten = 0;

  const bar = chalk.cyan(S_BAR);
  const grayBar = chalk.gray(S_BAR);

  function render(state = 'active') {
    if (linesWritten > 0) {
      process.stdout.write(`\x1B[${linesWritten}A\x1B[0J`);
    }

    const lines = [];
    lines.push(grayBar);

    if (state === 'submit') {
      const labels = order.map(id => {
        const opt = opts.options.find(o => o.value === id);
        return opt ? (opt.label || opt.value) : id;
      });
      lines.push(`${chalk.green(S_STEP_SUBMIT)}  ${opts.message}`);
      lines.push(`${grayBar}  ${chalk.dim(labels.join(' › '))}`);
      process.stdout.write(lines.join('\n') + '\n');
      linesWritten = lines.length;
      return;
    }

    if (state === 'cancel') {
      lines.push(`${chalk.red(S_STEP_CANCEL)}  ${opts.message}`);
      lines.push(`${grayBar}  ${chalk.strikethrough(chalk.dim('cancelled'))}`);
      process.stdout.write(lines.join('\n') + '\n');
      linesWritten = lines.length;
      return;
    }

    lines.push(`${chalk.cyan(S_STEP_ACTIVE)}  ${opts.message}`);
    if (grabbed) {
      lines.push(`${bar}  ${chalk.yellow('↑↓ move item  ·  Space release  ·  Enter confirm')}`);
    } else {
      lines.push(`${bar}  ${chalk.dim('↑↓ navigate  ·  Space grab & move  ·  Enter confirm')}`);
    }

    for (let i = 0; i < order.length; i++) {
      const id = order[i];
      const opt = opts.options.find(o => o.value === id);
      const label = opt ? (opt.label || opt.value) : id;
      const num = chalk.dim(`${i + 1}.`);
      if (i === cursor) {
        if (grabbed) {
          lines.push(`${bar}  ${num} ${chalk.yellow('⬡')} ${chalk.bold.yellow(label)}`);
        } else {
          lines.push(`${bar}  ${num} ${chalk.cyan('▶')} ${chalk.bold(label)}`);
        }
      } else {
        lines.push(`${bar}  ${num}   ${chalk.dim(label)}`);
      }
    }

    // Live preview
    const configForPreview = opts.getConfigForPreview(order);
    if (configForPreview && configForPreview.items.length > 0) {
      const previewStr = generatePreview(configForPreview);
      const visualWidth = stripVTControlCharacters(previewStr).length;
      const title = 'Live Preview';
      const boxWidth = Math.max(visualWidth + 2, title.length + 4);
      lines.push(bar);
      lines.push(`${bar}  ${chalk.dim(title)} ${chalk.gray('─'.repeat(boxWidth - title.length - 1) + '╮')}`);
      lines.push(`${bar}  ${previewStr}${chalk.gray(' '.repeat(boxWidth - visualWidth) + '│')}`);
      lines.push(`${bar}  ${chalk.gray('─'.repeat(boxWidth) + '╯')}`);
    }

    lines.push(chalk.cyan('└'));
    process.stdout.write(lines.join('\n') + '\n');
    linesWritten = lines.length;
  }

  return new Promise((resolve) => {
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    render();

    const onData = (chunk) => {
      const key = chunk;

      if (key === '\x1B[A') {
        // ↑ — navigate up; if grabbed, also move item
        if (grabbed && cursor > 0) {
          [order[cursor - 1], order[cursor]] = [order[cursor], order[cursor - 1]];
        }
        cursor = Math.max(0, cursor - 1);
        render();
      } else if (key === '\x1B[B') {
        // ↓ — navigate down; if grabbed, also move item
        if (grabbed && cursor < order.length - 1) {
          [order[cursor], order[cursor + 1]] = [order[cursor + 1], order[cursor]];
        }
        cursor = Math.min(order.length - 1, cursor + 1);
        render();
      } else if (key === ' ') {
        // Space — toggle grab
        grabbed = !grabbed;
        render();
      } else if (key === '\r' || key === '\n') {
        grabbed = false;
        cleanup();
        render('submit');
        resolve(order);
      } else if (key === '\x03' || key === '\x1B') {
        cleanup();
        render('cancel');
        resolve(Symbol('cancel'));
      }
    };

    const cleanup = () => {
      process.stdin.removeListener('data', onData);
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      process.stdin.pause();
    };

    process.stdin.on('data', onData);
  });
}
