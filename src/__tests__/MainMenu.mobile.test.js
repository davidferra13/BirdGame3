import { afterEach, expect, test } from 'vitest';
import { MainMenu } from '../ui/MainMenu';

afterEach(() => {
  document.body.replaceChildren();
});

test('menu remains scrollable and retains every action on short screens', () => {
  const menu = new MainMenu();
  const root = document.querySelector('#main-menu');
  expect(root.style.overflowY).toBe('auto');
  expect(root.style.justifyContent).toBe('flex-start');
  expect(root.querySelector('h1').style.fontSize).toContain('clamp(');
  const actions = [...root.querySelectorAll('button')].map(button => button.textContent.trim());
  expect(actions).toContain('PLAY');
  expect(actions).toContain('QUIT');
  expect(actions).toContain('SETTINGS');
  expect(actions).toContain('HOW TO PLAY');
  menu.hide();
  expect(root.style.display).toBe('none');
  menu.show();
  expect(root.style.display).toBe('flex');
});

test('touch devices receive instructions for their actual controls', () => {
  const previous = Object.getOwnPropertyDescriptor(navigator, 'maxTouchPoints');
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 1 });
  try {
    new MainMenu();
    const text = document.querySelector('#main-menu').textContent;
    expect(text).toContain('left thumb to fly');
    expect(text).not.toContain('WASD — Fly');
  } finally {
    if (previous) Object.defineProperty(navigator, 'maxTouchPoints', previous);
    else delete navigator.maxTouchPoints;
  }
});
