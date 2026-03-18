import { MultiSelectPrompt, SelectPrompt } from '@clack/core';
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
