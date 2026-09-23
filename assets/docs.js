(() => {
  'use strict';
  const toc = document.querySelector('#toc');
  if (!toc) return;
  const links = [...toc.querySelectorAll('a[href^="#"]')];
  const input = document.querySelector('#toc-search');
  const search = document.querySelector('.toc-search');
  const clear = document.querySelector('[data-clear-search]');
  const status = document.querySelector('[data-search-status]');
  search.hidden = false;
  const normalize = value => value.toLocaleLowerCase('ko').replace(/\s+/g, '');
  const headings = [...document.querySelectorAll('.doc h2, .doc h3')];
  const searchText = new Map(links.map(link => {
    const target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
    const heading = target?.matches('h2, h3') ? target : target?.querySelector('h2, h3');
    let content = '';
    if (heading) {
      const range = document.createRange();
      range.setStartBefore(heading);
      const next = headings[headings.indexOf(heading) + 1];
      if (next) range.setEndBefore(next);
      else range.setEndAfter(heading.closest('.chap') || heading);
      content = range.toString();
    }
    return [link, normalize(`${link.textContent} ${link.dataset.keywords || ''} ${content}`)];
  }));
  const filter = () => {
    const query = normalize(input.value);
    let count = 0;
    links.forEach(link => {
      link.hidden = Boolean(query) && !searchText.get(link).includes(query);
      if (!link.hidden) count++;
    });
    toc.querySelectorAll('.toc-sec').forEach(heading => {
      let sibling = heading.nextElementSibling;
      let visible = false;
      while (sibling && !sibling.matches('.toc-sec')) {
        if (sibling.matches('a') && !sibling.hidden) visible = true;
        sibling = sibling.nextElementSibling;
      }
      heading.hidden = !visible;
    });
    clear.hidden = !query;
    status.textContent = query ? count ? `${count}개 항목을 찾았습니다.` : '일치하는 안내가 없습니다. 다른 단어로 검색하거나 검색어를 지우세요.' : '';
  };
  input.addEventListener('input', filter);
  clear.addEventListener('click', () => { input.value = ''; filter(); input.focus(); });
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') { input.value = ''; filter(); }
    if (event.key === 'Enter') links.find(link => !link.hidden)?.click();
  });
  toc.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
    if (target) requestAnimationFrame(() => { target.tabIndex = -1; target.focus({ preventScroll: true }); });
  });

  const header = document.querySelector('.site-header');
  const readingProgress = document.querySelector('[data-reading-progress]');
  const progressTrack = readingProgress?.querySelector('[role="progressbar"]');
  const progressFill = readingProgress?.querySelector('.doc-progress-fill');
  const progressPercent = readingProgress?.querySelector('[data-reading-percent]');
  const readingStart = document.querySelector('.doc-in');
  const readingEnd = [...document.querySelectorAll('.doc .chap')].at(-1);
  let previousPercent;
  let previousHeaderHeight;
  if (readingProgress && readingStart && readingEnd) readingProgress.hidden = false;
  const updateProgress = headerHeight => {
    if (previousHeaderHeight !== headerHeight) {
      document.documentElement.style.setProperty('--doc-header-height', `${headerHeight}px`);
      previousHeaderHeight = headerHeight;
    }
    if (!readingProgress || readingProgress.hidden) return;
    // Start at the article, and finish when the last chapter is visible above the footer.
    const start = Math.max(0, readingStart.getBoundingClientRect().top + window.scrollY - headerHeight);
    const end = readingEnd.getBoundingClientRect().bottom + window.scrollY - window.innerHeight;
    const fraction = end <= start ? (window.scrollY >= start ? 1 : 0) : Math.min(1, Math.max(0, (window.scrollY - start) / (end - start)));
    progressFill.style.transform = `scaleX(${fraction})`;
    const percent = Math.floor(fraction * 100);
    if (previousPercent === percent) return;
    progressTrack.setAttribute('aria-valuenow', String(percent));
    progressTrack.setAttribute('aria-valuetext', `${percent}% 읽음`);
    progressPercent.textContent = `${percent}%`;
    previousPercent = percent;
  };

  const targets = links.map(link => ({ link, element: document.getElementById(decodeURIComponent(link.hash.slice(1))) })).filter(target => target.element);
  let scheduled = false;
  let previous;
  const updatePosition = () => {
    scheduled = false;
    const headerHeight = header?.getBoundingClientRect().height || 72;
    updateProgress(headerHeight);
    const boundary = headerHeight + 110;
    let current = targets[0];
    let closest = -Infinity;
    targets.forEach(target => {
      const top = target.element.getBoundingClientRect().top;
      if (top <= boundary && top >= closest) { current = target; closest = top; }
    });
    if (!current || previous === current.link) return;
    previous?.removeAttribute('aria-current');
    current.link.setAttribute('aria-current', 'location');
    previous = current.link;
  };
  const schedule = () => { if (!scheduled) { scheduled = true; requestAnimationFrame(updatePosition); } };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  window.addEventListener('hashchange', schedule);
  window.addEventListener('load', schedule);
  window.addEventListener('pageshow', schedule);
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(schedule);
    [header, document.querySelector('.shell'), readingStart].filter(Boolean).forEach(element => observer.observe(element));
  }
  document.fonts?.ready.then(schedule);
  updatePosition();

  document.querySelectorAll('[data-copy-command]').forEach(button => {
    button.hidden = false;
    button.addEventListener('click', async () => {
      const block = button.closest('.doc-command');
      const code = block.querySelector('code');
      const feedback = block.querySelector('[role="status"]');
      try {
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(code.textContent);
        feedback.textContent = '복사했습니다. 안내된 입력창에 붙여넣으세요.';
      } catch {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(code);
        selection.removeAllRanges();
        selection.addRange(range);
        feedback.textContent = '자동 복사가 제한되어 명령을 선택했습니다. 복사 단축키를 사용하세요.';
      }
    });
  });

  const dialog = document.querySelector('.doc-image-dialog');
  const image = dialog.querySelector('img');
  const title = dialog.querySelector('h2');
  let trigger;
  document.querySelectorAll('[data-doc-zoom]').forEach(button => {
    button.hidden = false;
    button.addEventListener('click', () => {
      const source = button.closest('figure').querySelector('img');
      image.src = source.currentSrc || source.src;
      image.alt = source.alt;
      image.style.width = `${Math.min(source.naturalWidth || 1440, 1680)}px`;
      title.textContent = source.alt || '안내 화면';
      trigger = button;
      dialog.showModal();
      document.documentElement.style.overflow = 'hidden';
    });
  });
  dialog.querySelector('[data-doc-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => {
    document.documentElement.style.overflow = '';
    trigger?.focus();
  });
})();
