async function copyText(text) {
  // Try the modern clipboard API first. If the browser blocks it, fall back to
  // the selection-based method used by older browsers.
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Continue to the fallback below.
    }
  }

  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.top = '0';
  field.style.left = '-9999px';
  document.body.appendChild(field);
  field.focus();
  field.select();

  const copied = document.execCommand('copy');
  field.remove();

  if (!copied) throw new Error('Clipboard copy failed');
}

function isMobileDevice() {
  return navigator.userAgentData?.mobile === true
    || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// Delegation also works if the share button is rendered after this script runs.
document.addEventListener('click', async (event) => {
  const codeButton = event.target.closest('[data-copy-code]');
  if (codeButton) {
    event.preventDefault();
    const status = codeButton.closest('.code-header')?.querySelector('[data-code-copy-status]');
    try {
      const binary = atob(codeButton.dataset.copyCode);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      await copyText(new TextDecoder().decode(bytes));
      codeButton.setAttribute('aria-label', codeButton.dataset.copySuccess || 'Copied');
      if (status) status.textContent = codeButton.dataset.copySuccess || 'Copied';
    } catch (error) {
      console.error('Code copy failed:', error);
      codeButton.setAttribute('aria-label', codeButton.dataset.copyFailure || 'Copy failed');
      if (status) status.textContent = codeButton.dataset.copyFailure || 'Copy failed';
    }
    window.setTimeout(() => {
      codeButton.setAttribute('aria-label', codeButton.title);
      if (status) status.textContent = '';
    }, 1800);
    return;
  }

  const button = event.target.closest('[data-copy-link], [data-share]');
  if (!button) return;

  event.preventDefault();
  const status = button.closest('.article-actions')?.querySelector('[data-share-status]');
  const data = {
    title: button.dataset.shareTitle || document.title,
    url: button.dataset.shareUrl || window.location.href,
  };

  const copyOnly = button.hasAttribute('data-copy-link');
  if (status) status.textContent = copyOnly
    ? (button.dataset.linkCopying || 'Copying link…')
    : (button.dataset.shareLabel || 'Sharing…');

  if (copyOnly) {
    try {
      await copyText(data.url);
      if (status) status.textContent = button.dataset.linkCopied || 'Link copied';
    } catch (error) {
      console.error('Article link copy failed:', error);
      if (status) status.textContent = button.dataset.copyFailed || 'Could not copy';
    }
    return;
  }

  // Use the native share sheet on phones. Desktop browsers often expose
  // navigator.share without having a usable share target, so copy the URL there.
  if (isMobileDevice() && navigator.share) {
    try {
      await navigator.share(data);
      if (status) status.textContent = button.dataset.shareSuccess || 'Shared';
      return;
    } catch (error) {
      if (error.name === 'AbortError') {
        if (status) status.textContent = button.dataset.shareCancelled || 'Sharing cancelled';
        return;
      }
      // Native sharing failed; try copying the URL instead.
    }
  }

  try {
    await copyText(data.url);
    if (status) status.textContent = button.dataset.urlCopied || 'URL copied';
  } catch (error) {
    console.error('Article sharing failed:', error);
    if (status) status.textContent = button.dataset.copyFailed || 'Could not copy. Please copy the article URL from the address bar.';
  }
});
