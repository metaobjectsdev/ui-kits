import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

// jsdom has HTMLDialogElement but not showModal()/close(). This stand-in does what the
// tests rely on: toggles `open` and fires `close` as a queued task, as browsers do. Esc is simulated by dispatching the
// `cancel` event a browser fires before it closes a modal dialog.
const proto = HTMLDialogElement.prototype as HTMLDialogElement & { __polyfilled?: boolean };
if (typeof proto.showModal !== 'function') {
  proto.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  proto.show = proto.showModal;
  proto.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    setTimeout(() => this.dispatchEvent(new Event('close')), 0);
  };
}

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});
