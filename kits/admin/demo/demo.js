// Behaviour for the static demo page: the theme contract, the phone drawer, the dialog
// and a toast with Undo, in plain JavaScript as a server-rendered admin would wire them.
import { initTheme, setTheme } from '../packages/admin-tokens/theme.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

// Theme: Auto / Light / Dark, stored under the shared `admin-theme` key.
function showTheme(theme) {
  for (const button of $$('[data-theme-choice]')) {
    button.setAttribute('aria-pressed', String(button.dataset.themeChoice === theme));
  }
}
showTheme(initTheme());
for (const button of $$('[data-theme-choice]')) {
  button.addEventListener('click', () => showTheme(setTheme(button.dataset.themeChoice)));
}

// Segmented controls: exactly one option pressed.
for (const group of $$('[data-seg]')) {
  group.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    for (const b of $$('button', group)) b.setAttribute('aria-pressed', String(b === button));
  });
}

// Phone drawer.
const shell = $('.ak-shell');
const menu = $('[data-nav-open]');
const main = $('.ak-main');
function setDrawer(open) {
  shell.toggleAttribute('data-nav-open', open);
  menu.setAttribute('aria-expanded', String(open));
  main.inert = open;
  if (open) $('.ak-drawer-close').focus();
  else menu.focus();
}
menu.addEventListener('click', () => setDrawer(true));
for (const el of $$('[data-nav-close]')) el.addEventListener('click', () => setDrawer(false));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && shell.hasAttribute('data-nav-open')) setDrawer(false);
});
matchMedia('(min-width: 1024px)').addEventListener('change', (event) => {
  if (event.matches && shell.hasAttribute('data-nav-open')) setDrawer(false);
});

// Toasts.
const toasts = $('.ak-toasts');
function toast(message, undo) {
  const el = document.createElement('div');
  el.className = 'ak-toast';
  const text = document.createElement('span');
  text.className = 'ak-toast-message';
  text.textContent = message;
  el.append(text);
  let remaining = undo ? 8000 : 6000;
  let timer = null;
  let started = 0;
  let hovered = false;
  let focused = false;
  const done = () => {
    clearTimeout(timer);
    el.remove();
  };
  // The clock stops while the pointer is over the toast or focus is inside it.
  const sync = () => {
    const paused = hovered || focused;
    if (paused && timer !== null) {
      clearTimeout(timer);
      timer = null;
      remaining -= Date.now() - started;
    } else if (!paused && timer === null && el.isConnected) {
      started = Date.now();
      timer = setTimeout(done, remaining);
    }
  };
  el.addEventListener('mouseenter', () => {
    hovered = true;
    sync();
  });
  el.addEventListener('mouseleave', () => {
    hovered = false;
    sync();
  });
  el.addEventListener('focusin', () => {
    focused = true;
    sync();
  });
  el.addEventListener('focusout', (event) => {
    focused = el.contains(event.relatedTarget);
    sync();
  });
  if (undo) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ak-btn ak-btn-sm';
    button.textContent = 'Undo';
    button.addEventListener('click', () => {
      undo();
      done();
    });
    el.append(button);
  }
  toasts.append(el);
  sync();
}
for (const button of $$('[data-toast]')) {
  button.addEventListener('click', () => toast(button.dataset.toast, () => toast('Restored')));
}

// Confirm dialog on native <dialog>.showModal(): focus trap, Esc and backdrop come free.
const dialog = $('#revoke');
let pendingRow = null;
for (const button of $$('[data-open-dialog]')) {
  button.addEventListener('click', () => {
    pendingRow = button.closest('tr');
    dialog.showModal();
    $('[data-dialog-cancel]', dialog).focus();
  });
}
$('[data-dialog-cancel]', dialog).addEventListener('click', () => dialog.close('cancel'));
$('[data-dialog-confirm]', dialog).addEventListener('click', () => dialog.close('confirm'));
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close('cancel');
});
dialog.addEventListener('close', () => {
  if (dialog.returnValue === 'confirm' && pendingRow) {
    const badge = $('.ak-badge', pendingRow);
    const previous = [badge.className, badge.textContent];
    badge.className = 'ak-badge ak-badge-danger';
    badge.textContent = 'Revoked';
    toast('Access revoked', () => {
      [badge.className, badge.textContent] = previous;
    });
  }
  dialog.returnValue = '';
  pendingRow = null;
});

// The demo form never submits anywhere.
$('[data-demo-form]').addEventListener('submit', (event) => {
  event.preventDefault();
  toast('Access granted');
});

// Charts: "Show as table" swaps the drawing for the same rows, as the React chart does.
for (const button of $$('.ak-chart-toggle')) {
  button.addEventListener('click', () => {
    const chart = button.closest('.ak-chart');
    const body = $('.ak-chart-body', chart);
    const table = $('.ak-chart-table', chart);
    const showTable = !body.hidden;
    body.hidden = showTable;
    table.classList.toggle('ak-sr-only', !showTable);
    button.textContent = showTable ? 'Show as chart' : 'Show as table';
  });
}
