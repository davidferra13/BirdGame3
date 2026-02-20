import type { KeyBindings } from '../core/InputManager';

const SPECIAL_KEYS: Record<string, string> = {
  Space: 'SPACE',
  Tab: 'TAB',
  ShiftLeft: 'L-SHIFT',
  ShiftRight: 'R-SHIFT',
  ControlLeft: 'L-CTRL',
  ControlRight: 'R-CTRL',
  AltLeft: 'L-ALT',
  AltRight: 'R-ALT',
  MetaLeft: 'L-META',
  MetaRight: 'R-META',
  Escape: 'ESC',
  Enter: 'ENTER',
  Backspace: 'BACKSPACE',
  Delete: 'DELETE',
  ArrowUp: 'UP',
  ArrowDown: 'DOWN',
  ArrowLeft: 'LEFT',
  ArrowRight: 'RIGHT',
  CapsLock: 'CAPS',
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  NumpadEnter: 'NUM ENTER',
  NumpadAdd: 'NUM +',
  NumpadSubtract: 'NUM -',
  NumpadMultiply: 'NUM *',
  NumpadDivide: 'NUM /',
  NumpadDecimal: 'NUM .',
  NumLock: 'NUM LOCK',
};

export function codeToDisplayName(code: string): string {
  if (SPECIAL_KEYS[code]) return SPECIAL_KEYS[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'NUM ' + code.slice(6);
  if (/^F\d+$/.test(code)) return code;
  return code;
}

export function bindingToDisplayName(bindings: KeyBindings, action: keyof KeyBindings): string {
  return codeToDisplayName(bindings[action]);
}
