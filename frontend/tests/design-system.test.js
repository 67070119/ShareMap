import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const theme = readFileSync(new URL('../src/app/design-system-dark.css', import.meta.url), 'utf8');
const layout = readFileSync(new URL('../src/app/layout.js', import.meta.url), 'utf8');

function token(name) {
  const match = theme.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
  assert.ok(match, `Missing CSS token --${name}`);
  return match[1];
}

function luminance(hex) {
  const channels = hex.slice(1).match(/.{2}/g).map((part) => parseInt(part, 16) / 255);
  const linear = channels.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test('dark stylesheet is imported after legacy page CSS and browser theme matches', () => {
  assert.ok(layout.indexOf("import './design-system-dark.css'") > layout.indexOf("import './admin-ux.css'"));
  assert.ok(layout.includes("themeColor: '#0b1120'"));
});

test('dark foundation has legible semantic text and action colors', () => {
  assert.ok(contrast(token('ui-ink'), token('ui-bg')) >= 7);
  assert.ok(contrast(token('ui-text'), token('ui-surface')) >= 4.5);
  assert.ok(contrast(token('ui-muted'), token('ui-surface')) >= 4.5);
  assert.ok(contrast(token('ui-primary-contrast'), token('ui-primary')) >= 4.5);
});

test('shared dark-state primitives and keyboard focus rules exist', () => {
  for (const selector of ['.ui-button', '.ui-card', '.ui-input', '.ui-select', '.ui-modal', '.ui-toast', '.ui-skeleton', '.ui-state', '*:focus-visible']) {
    assert.ok(theme.includes(selector), `Missing ${selector}`);
  }
});
