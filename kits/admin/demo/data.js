// Behaviour for the layout-and-data demo page, in plain JavaScript as a server-rendered
// admin would wire it: theme, drawer, row menu, palette, tier-3 confirm, queue keys, copy.
import { initTheme, setTheme } from '../packages/admin-tokens/theme.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function showTheme(theme) {
  for (const button of $$('[data-theme-choice]')) button.setAttribute('aria-pressed', String(button.dataset.themeChoice === theme));
}
showTheme(initTheme());
for (const button of $$('[data-theme-choice]')) button.addEventListener('click', () => showTheme(setTheme(button.dataset.themeChoice)));

for (const group of $$('[data-seg]')) {
  group.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    for (const b of $$('button', group)) b.setAttribute('aria-pressed', String(b === button));
  });
}

const typing = (el) => el instanceof HTMLElement && (el.isContentEditable || el.matches('textarea, select, input:not([type=checkbox]):not([type=radio]):not([type=button])'));

// A modal that returns focus to its opener and closes on the backdrop.
function modal(dialog) {
  let opener = null;
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => opener?.focus?.());
  return () => {
    opener = document.activeElement;
    dialog.showModal();
  };
}

// Drawer: opens from a row; Esc comes from the native dialog.
const drawer = $('[data-drawer]');
const openDrawer = modal(drawer);
for (const row of $$('[data-open-drawer]')) {
  row.addEventListener('click', (event) => {
    if (event.target.closest('input, [data-menu], .ak-iedit')) return;
    openDrawer();
    $('[data-drawer-close]', drawer).focus();
  });
}
for (const button of $$('[data-drawer-close]')) button.addEventListener('click', () => drawer.close());

// Row-action menu, fixed to the viewport.
const menu = $('[data-menu-list]');
let menuButton = null;
function closeMenu(refocus) {
  menu.hidden = true;
  menuButton?.setAttribute('aria-expanded', 'false');
  if (refocus) menuButton?.focus();
}
for (const button of $$('[data-menu]')) {
  button.addEventListener('click', () => {
    if (!menu.hidden && menuButton === button) return closeMenu(false);
    menuButton = button;
    const rect = button.getBoundingClientRect();
    menu.style.right = `${Math.max(8, innerWidth - rect.right)}px`;
    menu.style.top = `${rect.bottom + 4}px`;
    menu.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    $('[role=menuitem]:not([disabled])', menu).focus();
  });
}
menu.addEventListener('keydown', (event) => {
  const items = $$('[role=menuitem]:not([disabled])', menu);
  const at = items.indexOf(document.activeElement);
  if (event.key === 'ArrowDown') items[(at + 1) % items.length].focus();
  else if (event.key === 'ArrowUp') items[(at - 1 + items.length) % items.length].focus();
  else if (event.key === 'Escape') closeMenu(true);
  else return;
  event.preventDefault();
});
menu.addEventListener('click', (event) => {
  if (event.target.closest('[role=menuitem]')) closeMenu(true);
});
document.addEventListener('pointerdown', (event) => {
  if (!menu.hidden && !menu.contains(event.target) && !event.target.closest('[data-menu]')) closeMenu(false);
});
addEventListener('scroll', () => closeMenu(false), true);

// Command palette: / or Ctrl+K, not while typing.
const palette = $('[data-palette]');
const openPalette = modal(palette);
const showPalette = () => {
  openPalette();
  $('[data-palette-input]', palette).focus();
};
$('[data-open-palette]').addEventListener('click', showPalette);
document.addEventListener('keydown', (event) => {
  if (document.querySelector('dialog[open]')) return;
  const k = event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey);
  if (k || (event.key === '/' && !typing(event.target))) {
    event.preventDefault();
    showPalette();
  }
});

// Tier 3: confirm stays disabled until a second factor is entered.
const tier = $('[data-tier-dialog]');
const openTier = modal(tier);
const code = $('[data-tier-code]', tier);
$('[data-open-tier]').addEventListener('click', () => {
  code.value = '';
  $('[data-tier-confirm]', tier).disabled = true;
  openTier();
  $('[data-tier-cancel]', tier).focus();
});
code.addEventListener('input', () => {
  $('[data-tier-confirm]', tier).disabled = !code.value.trim();
});
for (const b of $$('[data-tier-cancel], [data-tier-confirm]', tier)) b.addEventListener('click', () => tier.close());

// Queue: j/k move, number keys act and advance.
const queue = $('[data-queue]');
const focusItem = (item) => {
  for (const li of $$('li', queue)) {
    const on = li === item;
    li.setAttribute('aria-selected', String(on));
    li.classList.toggle('ak-queue-item-focused', on);
  }
  $('[data-queue-title]').textContent = item.textContent;
};
const step = (n) => {
  const items = $$('li', queue);
  const at = items.findIndex((li) => li.getAttribute('aria-selected') === 'true');
  const next = items[Math.min(Math.max(at + n, 0), items.length - 1)];
  if (next) focusItem(next);
};
for (const li of $$('li', queue)) li.addEventListener('click', () => focusItem(li));
const acts = $$('[data-queue-act]');
for (const b of acts) b.addEventListener('click', () => step(1));
document.addEventListener('keydown', (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey || typing(event.target) || document.querySelector('dialog[open]')) return;
  if (event.key === 'j') step(1);
  else if (event.key === 'k') step(-1);
  else if (/^[1-9]$/.test(event.key) && acts[Number(event.key) - 1]) acts[Number(event.key) - 1].click();
});

// Copy.
for (const button of $$('[data-copy]')) {
  button.addEventListener('click', async () => {
    const status = button.nextElementSibling;
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      button.textContent = status.textContent = 'Copied';
    } catch {
      button.textContent = 'Failed';
      status.textContent = 'Copy failed';
    }
    setTimeout(() => {
      button.textContent = 'Copy';
      status.textContent = '';
    }, 2000);
  });
}
