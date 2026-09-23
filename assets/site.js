(() => {
  'use strict';
  const root = document.documentElement;
  const themeButton = document.querySelector('.theme-toggle');
  const syncTheme = () => {
    const dark = root.dataset.theme === 'dark';
    if (themeButton) {
      themeButton.setAttribute('aria-label', `${dark ? '라이트' : '다크'} 모드로 전환`);
      themeButton.title = `${dark ? '라이트' : '다크'} 모드로 전환`;
    }
    document.querySelectorAll('img[data-light-src][data-dark-src]').forEach(img => {
      img.src = dark ? img.dataset.darkSrc : img.dataset.lightSrc;
    });
  };
  const applyTheme = theme => {
    const style = document.createElement('style');
    style.textContent = '*,*::before,*::after{transition:none!important}';
    document.head.append(style);
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    syncTheme();
    void root.offsetHeight;
    requestAnimationFrame(() => style.remove());
  };
  syncTheme();
  themeButton?.addEventListener('click', () => {
    const theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(theme);
    try { localStorage.setItem('nxl-web-theme', theme); } catch {}
  });
  window.addEventListener('storage', event => {
    if (event.key === 'nxl-web-theme') applyTheme(event.newValue === 'light' ? 'light' : 'dark');
  });

  const menuButton = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.site-nav');
  const closeMenu = () => {
    nav?.classList.remove('is-open');
    menuButton?.setAttribute('aria-expanded', 'false');
    menuButton?.setAttribute('aria-label', '메뉴 열기');
  };
  menuButton?.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
  });
  nav?.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menuButton?.getAttribute('aria-expanded') === 'true') {
      closeMenu();
      menuButton.focus();
    }
  });
  matchMedia('(min-width: 38.01rem)').addEventListener('change', closeMenu);

  // A link to an installation guide also reveals its collapsed instructions.
  const revealHashDetails = (hash = location.hash) => {
    let target;
    try { target = document.getElementById(decodeURIComponent(hash.slice(1))); } catch { return; }
    for (let element = target; element; element = element.parentElement) {
      if (element.matches('details')) element.open = true;
    }
  };
  revealHashDetails();
  window.addEventListener('hashchange', () => revealHashDetails());
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (link && !event.defaultPrevented && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) revealHashDetails(link.hash);
  });

  const documentToc = document.querySelector('.doc-toc');
  if (documentToc) {
    const compactDocument = matchMedia('(max-width: 52rem)');
    const syncToc = () => { documentToc.open = !compactDocument.matches; };
    syncToc();
    compactDocument.addEventListener('change', syncToc);
    documentToc.addEventListener('click', event => {
      if (compactDocument.matches && event.target.closest('a')) documentToc.open = false;
    });
  }

  const previews = {
    prototype: { label: '프로토타입', alt: 'Studio의 주말의 발견 프로토타입. 전시 예약 화면을 직접 체험하며 다음 행동과 전체 단계를 확인하는 화면' },
    dev: { label: '개발', alt: 'Studio의 주말의 발견 개발 작업대. 연결된 프로젝트의 파일과 화면 코드를 확인하는 화면' },
    design: { label: '화면 디자인', alt: 'Studio에서 완성된 LIFEPLUS SELECT 멤버십 홈 화면을 편집하는 디자인 캔버스와 레이어·속성 패널' },
    spec: { label: '기획 · 기능명세', alt: 'Studio의 주말의 발견 전시 예약 예제. 예약 기능의 대상 사용자, 동작 설명과 완료 조건을 검토하는 화면' },
    flow: { label: 'User Flow', alt: 'Studio의 주말의 발견 사용자 흐름. 경험 탐색, 전시 상세, 방문 일정, 예약 완료 화면이 연결된 캔버스' },
  };
  const tabs = [...document.querySelectorAll('[data-preview]')];
  const selectPreview = tab => {
    const key = tab.dataset.preview;
    const preview = previews[key];
    if (!preview) return;
    tabs.forEach(item => {
      item.setAttribute('aria-selected', String(item === tab));
      item.tabIndex = item === tab ? 0 : -1;
    });
    document.querySelector('#preview-label').textContent = preview.label;
    document.querySelector('#preview-panel').setAttribute('aria-labelledby', tab.id);
    ['light', 'dark'].forEach(theme => {
      const img = document.querySelector(`#preview-${theme}`);
      img.src = tab.dataset[`${theme}Src`];
      img.alt = `${preview.alt} (${theme === 'light' ? '라이트' : '다크'} 모드)`;
    });
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectPreview(tab));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      selectPreview(tabs[next]);
      tabs[next].focus();
    });
  });
  const dialog = document.querySelector('.image-dialog');
  const zoomButton = document.querySelector('[data-zoom]');
  zoomButton?.addEventListener('click', () => {
    const screenshot = document.querySelector(`#preview-${root.dataset.theme === 'dark' ? 'dark' : 'light'}`);
    const image = document.querySelector('#dialog-image');
    image.src = screenshot.src;
    image.alt = screenshot.alt;
    document.querySelector('#image-dialog-title').textContent = `NEXTLAB Studio · ${document.querySelector('#preview-label').textContent}`;
    dialog.showModal();
    root.style.overflow = 'hidden';
  });
  document.querySelector('[data-close-dialog]')?.addEventListener('click', () => dialog.close());
  dialog?.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog?.addEventListener('close', () => {
    root.style.overflow = '';
    zoomButton?.focus();
  });

  // Artifact metadata is the single source of truth. Failed requests never leave stale links.
  const byteLabel = bytes => Number.isFinite(bytes) && bytes > 0 ? ` · ${(bytes / 1024 / 1024).toFixed(1)} MB` : '';
  const artifactURL = (value, extension) => {
    if (typeof value !== 'string' || !value) return null;
    try {
      const url = new URL(value, location.origin);
      const local = url.origin === location.origin && url.pathname.startsWith('/releases/');
      const github = url.protocol === 'https:' && url.hostname === 'github.com' && url.pathname.startsWith('/DevJH/nxl-web/releases/download/');
      return (local || github) && url.pathname.toLowerCase().endsWith(extension) ? url.href : null;
    } catch { return null; }
  };
  const setDownloadLabel = (link, label) => {
    const content = link.querySelector('[data-download-label]');
    (content || link).textContent = label;
  };
  const setLink = (key, file, extension) => {
    const url = artifactURL(file?.url || file?.path, extension);
    document.querySelectorAll(`[data-download="${key}"]`).forEach(link => {
      if (url) {
        link.href = url;
        link.removeAttribute('aria-disabled');
        setDownloadLabel(link, link.dataset.readyLabel || (link.querySelector('[data-download-label]') ? '다운로드' : '다운로드 ↓'));
        link.setAttribute('aria-label', `${key === 'builder' ? 'NEXTLAB Builder' : key === 'win' ? 'Windows 64비트용 NEXTLAB Studio' : key === 'mac-arm64' ? 'macOS Apple Silicon용 NEXTLAB Studio' : 'macOS Intel용 NEXTLAB Studio'} 다운로드`);
      } else {
        link.removeAttribute('href');
        link.setAttribute('aria-disabled', 'true');
        link.removeAttribute('aria-label');
        setDownloadLabel(link, '설치 파일 없음');
      }
    });
    document.querySelectorAll(`[data-file-size="${key}"]`).forEach(el => { el.textContent = url ? byteLabel(file.bytes) : ''; });
    return Boolean(url);
  };
  const requests = new Set();
  async function loadRelease(product) {
    if (requests.has(product)) return;
    requests.add(product);
    const status = document.querySelector(`[data-release-status="${product}"]`);
    const retry = document.querySelector(`[data-retry="${product}"]`);
    if (status) status.textContent = '설치 정보를 불러오고 있습니다.';
    if (retry) { retry.disabled = true; retry.hidden = true; }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(product === 'studio' ? '/studio/version.json' : '/release-manifest.json', { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error('Release metadata unavailable');
      const data = await response.json();
      const release = product === 'studio' ? data : data.releases?.[0];
      if (!release || typeof release.version !== 'string' || !/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(release.version)) throw new Error('Invalid release metadata');
      document.querySelectorAll(`[data-version="${product}"]`).forEach(el => { el.textContent = `v${release.version}`; });
      document.querySelectorAll(product === 'studio' ? '[data-studio-ver]' : '[data-ver]').forEach(el => { el.textContent = release.version; });
      let complete;
      if (product === 'studio') {
        const results = ['mac-arm64', 'mac-x64', 'win'].map(key => setLink(key, release.platforms?.[key], key === 'win' ? '.exe' : '.dmg'));
        complete = results.every(Boolean);
      } else complete = setLink('builder', release.vsix, '.vsix');
      if (status) status.textContent = complete ? '' : '일부 설치 파일이 아직 제공되지 않습니다. 다른 운영체제용 파일 대신 업데이트 내역을 확인해 주세요.';
    } catch {
      document.querySelectorAll(`[data-version="${product}"]`).forEach(el => { el.textContent = '버전 확인 불가'; });
      (product === 'studio' ? ['mac-arm64', 'mac-x64', 'win'] : ['builder']).forEach(key => {
        setLink(key, null, '');
        document.querySelectorAll(`[data-download="${key}"]`).forEach(el => { setDownloadLabel(el, '불러오기 실패'); });
      });
      if (status) status.textContent = '설치 정보를 불러오지 못했습니다. 연결을 확인하고 다시 시도해 주세요.';
      if (retry) retry.hidden = false;
    } finally {
      clearTimeout(timeout);
      requests.delete(product);
      if (retry) retry.disabled = false;
    }
  }
  ['studio', 'builder'].forEach(product => {
    if (document.querySelector(`[data-version="${product}"], ${product === 'studio' ? '[data-studio-ver]' : '[data-ver]'}`)) loadRelease(product);
  });
  document.querySelectorAll('[data-retry]').forEach(button => button.addEventListener('click', () => loadRelease(button.dataset.retry)));
})();
