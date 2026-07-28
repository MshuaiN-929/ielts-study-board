(() => {
  const ORDER_KEY = 'ielts-board-task-order-v2';
  const STATUS_KEY = 'ielts-board-status-v2';
  const DURATION_KEY = 'ielts-board-task-duration-v1';
  const SESSION_START = { morning: '09:00', afternoon: '13:00', evening: '19:00' };
  const PERIODS = [
    { id: 'morning', label: '上午', icon: '☀️' },
    { id: 'noon', label: '中午', icon: '🍚' },
    { id: 'afternoon', label: '下午', icon: '🌤️' },
    { id: 'evening', label: '晚上', icon: '🌙' },
  ];
  const STATUSES = [
    ['活力满满', '😄'], ['火力全开', '🔥'], ['状态在线', '✨'], ['渐入佳境', '🚀'],
    ['平静专注', '🧘'], ['普通发挥', '🙂'], ['有点走神', '👀'], ['胡思乱想', '💭'],
    ['有点焦虑', '😵‍💫'], ['有点疲劳', '🥱'], ['脑子卡住', '🫠'], ['完全没电', '🪫'],
    ['好饿好饿', '🍜'], ['吃饱困困', '😪'], ['心情很好', '🥰'], ['有点烦躁', '😤'],
    ['不想阅读', '📖'], ['慢慢启动', '🐢'], ['重新振作', '🌱'], ['今天很棒', '🌟'],
  ];

  const parseJSON = (value, fallback) => {
    try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
  };
  const dateKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const currentPlanDay = () => {
    const text = document.querySelector('.day-heading h2')?.textContent || 'Day 1';
    return `day-${text.match(/(\d+)/)?.[1] || 1}`;
  };
  const taskName = (tile) => tile.querySelector('.task-copy > strong')?.textContent?.trim() || '';
  const taskMinutes = (tile) => Number(tile.dataset.taskMinutes || (tile.querySelector('.task-meta span')?.textContent || '').match(/·\s*(\d+)分钟/)?.[1] || 0);
  const toMin = (time) => { const [h, m] = time.split(':').map(Number); return h * 60 + m; };
  const fmt = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;


  function durationData() { return parseJSON(localStorage.getItem(DURATION_KEY), {}); }
  function durationKey(tile) { return `${currentPlanDay()}:${taskName(tile)}`; }
  function saveDuration(tile, minutes) {
    const all = durationData();
    const key = durationKey(tile);
    if (minutes === Number(tile.dataset.originalMinutes)) delete all[key];
    else all[key] = minutes;
    localStorage.setItem(DURATION_KEY, JSON.stringify(all));
  }
  function applySavedDurations() {
    const all = durationData();
    document.querySelectorAll('.task-tile').forEach((tile) => {
      if (!tile.dataset.originalMinutes) {
        const original = Number((tile.querySelector('.task-meta span')?.textContent || '').match(/·\s*(\d+)分钟/)?.[1] || 0);
        tile.dataset.originalMinutes = String(original);
      }
      const saved = Number(all[durationKey(tile)] || 0);
      tile.dataset.taskMinutes = String(saved > 0 ? saved : Number(tile.dataset.originalMinutes));
    });
  }
  function updatePlanDurationLabel() {
    const heading = document.querySelector('.task-board .board-heading');
    if (!heading) return;
    const total = [...document.querySelectorAll('.task-tile')].reduce((sum, tile) => sum + taskMinutes(tile), 0);
    const hours = Math.floor(total / 60);
    const minutes = total % 60;
    const text = hours ? `${hours}小时${minutes ? `${minutes}分钟` : ''}` : `${minutes}分钟`;
    let label = heading.querySelector('.adjusted-plan-time');
    if (!label) {
      label = document.createElement('p');
      label.className = 'adjusted-plan-time';
      const original = heading.querySelector(':scope > p');
      if (original) original.replaceWith(label); else heading.appendChild(label);
    }
    label.textContent = `计划 ${text} · 单词另计`;
  }
  function setupDurationEditing() {
    applySavedDurations();
    document.querySelectorAll('.task-tile').forEach((tile) => {
      const meta = tile.querySelector('.task-meta');
      const timeText = meta?.querySelector(':scope > span');
      if (!meta || !timeText) return;
      timeText.classList.add('editable-time');
      timeText.title = '点击调整任务时长';
      if (!timeText.dataset.durationReady) {
        timeText.dataset.durationReady = '1';
        const edit = (event) => {
          event.preventDefault();
          event.stopPropagation();
          const current = taskMinutes(tile);
          const original = Number(tile.dataset.originalMinutes || current);
          const answer = window.prompt(`调整“${taskName(tile)}”的时长（分钟）\n输入 5–240；输入 0 恢复原时长 ${original} 分钟。`, String(current));
          if (answer === null) return;
          const value = Number.parseInt(answer.trim(), 10);
          if (!Number.isFinite(value) || value < 0 || value > 240 || (value > 0 && value < 5)) {
            window.alert('请输入 5–240 之间的整数；输入 0 可恢复原时长。');
            return;
          }
          const next = value === 0 ? original : value;
          tile.dataset.taskMinutes = String(next);
          saveDuration(tile, next);
          refreshTimes();
          updatePlanDurationLabel();
        };
        timeText.addEventListener('pointerdown', (event) => event.stopPropagation());
        timeText.addEventListener('click', edit);
      }
    });

    const tools = document.querySelector('.reorder-tools');
    if (tools && !tools.querySelector('.reset-durations')) {
      const reset = document.createElement('button');
      reset.type = 'button';
      reset.className = 'reset-durations';
      reset.textContent = '恢复原时长';
      reset.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const all = durationData();
        const prefix = `${currentPlanDay()}:`;
        Object.keys(all).forEach((key) => { if (key.startsWith(prefix)) delete all[key]; });
        localStorage.setItem(DURATION_KEY, JSON.stringify(all));
        document.querySelectorAll('.task-tile').forEach((tile) => {
          tile.dataset.taskMinutes = tile.dataset.originalMinutes || tile.dataset.taskMinutes;
        });
        refreshTimes();
        updatePlanDurationLabel();
      });
      tools.appendChild(reset);
    }
    refreshTimes();
    updatePlanDurationLabel();
  }

  function orderData() { return parseJSON(localStorage.getItem(ORDER_KEY), {}); }
  function saveOrder() {
    const data = orderData();
    data[currentPlanDay()] = [...document.querySelectorAll('.session-block')].flatMap((block) => {
      const session = [...block.classList].find((x) => SESSION_START[x]);
      return [...block.querySelectorAll('.task-tile')].map((tile) => ({ name: taskName(tile), session }));
    });
    localStorage.setItem(ORDER_KEY, JSON.stringify(data));
  }
  function refreshTimes() {
    document.querySelectorAll('.session-block').forEach((block) => {
      const session = [...block.classList].find((x) => SESSION_START[x]);
      if (!session) return;
      let cursor = toMin(SESSION_START[session]);
      const tiles = [...block.querySelectorAll('.task-tile')];
      tiles.forEach((tile) => {
        const duration = taskMinutes(tile);
        const meta = tile.querySelector('.task-meta span');
        if (meta) meta.textContent = `${fmt(cursor)}–${fmt(cursor + duration)} · ${duration}分钟 ✎`;
        const stars = tile.querySelector('.task-stars');
        if (stars) stars.textContent = `+${Math.max(1, Math.round(duration / 30))} ✦`;
        cursor += duration;
      });
      const count = block.querySelector('.session-heading small');
      if (count) count.textContent = `${tiles.filter((t) => t.classList.contains('done')).length}/${tiles.length}`;
    });
  }

  function restoreOrder() {
    const saved = orderData()[currentPlanDay()];
    if (!saved?.length) return refreshTimes();
    const tiles = new Map([...document.querySelectorAll('.task-tile')].map((t) => [taskName(t), t]));
    const grids = {};
    document.querySelectorAll('.session-block').forEach((block) => {
      const session = [...block.classList].find((x) => SESSION_START[x]);
      grids[session] = block.querySelector('.task-grid');
    });
    saved.forEach(({ name, session }) => { if (tiles.get(name) && grids[session]) grids[session].appendChild(tiles.get(name)); });
    refreshTimes();
  }
  function setupDragging() {
    const heading = document.querySelector('.task-board .board-heading');
    if (heading && !heading.querySelector('.reorder-tools')) {
      const tools = document.createElement('div');
      tools.className = 'reorder-tools';
      tools.innerHTML = '<button type="button" class="reset-order">恢复原计划</button>';
      tools.querySelector('.reset-order').addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const data = orderData();
        delete data[currentPlanDay()];
        localStorage.setItem(ORDER_KEY, JSON.stringify(data));
        location.reload();
      });
      heading.appendChild(tools);
    }

    document.querySelectorAll('.task-tile').forEach((tile) => {
      if (tile.dataset.dragReady) return;
      tile.dataset.dragReady = '1';
      const handle = document.createElement('button');
      handle.type = 'button';
      handle.className = 'drag-handle';
      handle.textContent = '⋮⋮';
      handle.title = '按住拖动任务';
      handle.setAttribute('aria-label', '拖动调整任务顺序');
      tile.appendChild(handle);

      handle.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
      });

      handle.addEventListener('pointerdown', (event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        const sourceGrid = tile.closest('.task-grid');
        if (!sourceGrid) return;
        handle.setPointerCapture?.(event.pointerId);
        const rect = tile.getBoundingClientRect();
        const placeholder = document.createElement('div');
        placeholder.className = 'task-placeholder';
        placeholder.style.height = `${rect.height}px`;
        sourceGrid.insertBefore(placeholder, tile);
        tile.classList.add('task-dragging-live');
        Object.assign(tile.style, {
          position: 'fixed',
          zIndex: '100000',
          width: `${rect.width}px`,
          height: `${rect.height}px`,
          left: `${rect.left}px`,
          top: `${rect.top}px`,
          margin: '0',
          pointerEvents: 'none',
        });
        document.body.appendChild(tile);
        const offsetX = event.clientX - rect.left;
        const offsetY = event.clientY - rect.top;

        const pointInGrid = (x, y) => [...document.querySelectorAll('.task-grid')].find((grid) => {
          const r = grid.getBoundingClientRect();
          return x >= r.left && x <= r.right && y >= r.top - 24 && y <= r.bottom + 24;
        });

        const placeMarker = (grid, x, y) => {
          const items = [...grid.querySelectorAll('.task-tile')];
          if (!items.length) { grid.appendChild(placeholder); return; }
          let best = null;
          items.forEach((item) => {
            const r = item.getBoundingClientRect();
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;
            const score = Math.hypot((x - cx) * 0.8, y - cy);
            if (!best || score < best.score) best = { item, r, cx, cy, score };
          });
          if (!best) { grid.appendChild(placeholder); return; }
          const sameRow = Math.abs(y - best.cy) < best.r.height * 0.55;
          const before = sameRow ? x < best.cx : y < best.cy;
          grid.insertBefore(placeholder, before ? best.item : best.item.nextSibling);
        };

        const onMove = (moveEvent) => {
          moveEvent.preventDefault();
          tile.style.left = `${moveEvent.clientX - offsetX}px`;
          tile.style.top = `${moveEvent.clientY - offsetY}px`;
          const grid = pointInGrid(moveEvent.clientX, moveEvent.clientY);
          if (grid) placeMarker(grid, moveEvent.clientX, moveEvent.clientY);
        };

        const finish = (upEvent) => {
          upEvent?.preventDefault?.();
          handle.releasePointerCapture?.(event.pointerId);
          handle.removeEventListener('pointermove', onMove);
          handle.removeEventListener('pointerup', finish);
          handle.removeEventListener('pointercancel', finish);
          placeholder.parentNode?.insertBefore(tile, placeholder);
          placeholder.remove();
          tile.classList.remove('task-dragging-live');
          tile.removeAttribute('style');
          tile.dataset.suppressNextClick = '1';
          setTimeout(() => { delete tile.dataset.suppressNextClick; }, 180);
          saveOrder();
          refreshTimes();
        };

        handle.addEventListener('pointermove', onMove);
        handle.addEventListener('pointerup', finish);
        handle.addEventListener('pointercancel', finish);
      });

      tile.addEventListener('click', (event) => {
        if (tile.dataset.suppressNextClick) {
          event.preventDefault();
          event.stopPropagation();
        }
      }, true);
    });
    restoreOrder();
  }

  const statusData = () => parseJSON(localStorage.getItem(STATUS_KEY), {});
  function getTodayStatuses() { return statusData()[dateKey()] || {}; }
  function setStatus(period, value) {
    const all = statusData(); all[dateKey()] = { ...(all[dateKey()] || {}), [period]: value };
    localStorage.setItem(STATUS_KEY, JSON.stringify(all)); updateSummary();
    const syncLayout = () => {
      const grid = document.querySelector('.content-grid');
      const taskBoard = document.querySelector('.task-board');
      const aside = document.querySelector('.record-card');
      const status = document.querySelector('.status-checkin');
      if (!grid) return;
      if (window.innerWidth <= 980) {
        grid.style.gridTemplateColumns = 'minmax(0, 1fr)';
        if (status) status.style.gridColumn = '1';
        if (taskBoard) taskBoard.style.gridColumn = '1';
        if (aside) aside.style.gridColumn = '1';
      } else {
        grid.style.gridTemplateColumns = 'minmax(0, 1fr) minmax(300px, 360px)';
        if (status) status.style.gridColumn = '1 / -1';
        if (taskBoard) taskBoard.style.gridColumn = '1';
        if (aside) aside.style.gridColumn = '2';
      }
    };
    syncLayout();
    if (!window.__ieltsLayoutListener) {
      window.__ieltsLayoutListener = true;
      window.addEventListener('resize', syncLayout);
    }
  }
  function updateSummary() {
    const summary = document.querySelector('.mood-summary-grid'); if (!summary) return;
    const data = getTodayStatuses();
    summary.innerHTML = PERIODS.map((p) => {
      const value = data[p.id] || { text: '还没记录', emoji: '○' };
      return `<div class="mood-summary-item"><span>${p.icon}</span><small>${p.label}</small><strong>${value.emoji} ${value.text}</strong></div>`;
    }).join('');
  }
  function renderStatusArea() {
    const board = document.querySelector('.task-board');
    if (!board || document.querySelector('.status-checkin')) return;
    const data = getTodayStatuses();
    const section = document.createElement('section');
    section.className = 'status-checkin';
    section.style.gridColumn = '1 / -1';
    section.style.width = '100%';
    section.style.maxWidth = 'none';
    section.style.boxSizing = 'border-box';
    section.innerHTML = '<div class="status-title"><div><p class="eyebrow">CURRENT STATUS</p><h2>现在是什么状态？</h2></div><small>上午、中午、下午、晚上各记一次</small></div><div class="status-cards"></div>';
    const cards = section.querySelector('.status-cards');
    PERIODS.forEach((period) => {
      const selected = data[period.id] || { text: '点击记录', emoji: '＋' };
      const card = document.createElement('div'); card.className = 'status-card';
      card.innerHTML = `<div class="status-period"><span>${period.icon}</span><strong>${period.label}</strong></div><button class="status-current" type="button"><span>${selected.emoji}</span><strong>${selected.text}</strong></button><div class="status-options" hidden></div>`;
      const options = card.querySelector('.status-options');
      STATUSES.forEach(([text, emoji]) => {
        const btn = document.createElement('button'); btn.type = 'button'; btn.innerHTML = `<span>${emoji}</span>${text}`;
        btn.onclick = () => { setStatus(period.id, { text, emoji }); card.querySelector('.status-current').innerHTML = `<span>${emoji}</span><strong>${text}</strong>`; options.hidden = true; };
        options.appendChild(btn);
      });
      const custom = document.createElement('button'); custom.type = 'button'; custom.className = 'custom-status'; custom.innerHTML = '<span>✍️</span>自定义状态';
      custom.onclick = () => { const text = prompt('写下你现在的状态：'); if (!text?.trim()) return; const value = { text: text.trim().slice(0, 12), emoji: '📝' }; setStatus(period.id, value); card.querySelector('.status-current').innerHTML = `<span>📝</span><strong>${value.text}</strong>`; options.hidden = true; };
      options.appendChild(custom);
      card.querySelector('.status-current').onclick = () => { document.querySelectorAll('.status-options').forEach((x) => { if (x !== options) x.hidden = true; }); options.hidden = !options.hidden; };
      cards.appendChild(card);
    });
    const contentGrid = board.parentNode;
    contentGrid.style.display = 'grid';
    contentGrid.style.gridTemplateColumns = 'minmax(0, 1fr) minmax(300px, 360px)';
    contentGrid.style.alignItems = 'start';
    section.style.gridColumn = '1 / -1';
    contentGrid.insertBefore(section, board);
    board.style.gridColumn = '1';
    board.style.minWidth = '0';
    const aside = contentGrid.querySelector('.record-card');
    if (aside) { aside.style.gridColumn = '2'; aside.style.minWidth = '0'; }

    const footer = document.querySelector('footer');
    const summary = document.createElement('section'); summary.className = 'mood-summary';
    summary.innerHTML = '<div class="mood-summary-heading"><div><p class="eyebrow">TODAY\'S MOOD MAP</p><h2>今日心情状态总览</h2></div><small>一天不是只有一种状态，变化也算记录</small></div><div class="mood-summary-grid"></div>';
    footer?.parentNode.insertBefore(summary, footer);
    updateSummary();
    const syncLayout = () => {
      const grid = document.querySelector('.content-grid');
      const taskBoard = document.querySelector('.task-board');
      const aside = document.querySelector('.record-card');
      const status = document.querySelector('.status-checkin');
      if (!grid) return;
      if (window.innerWidth <= 980) {
        grid.style.gridTemplateColumns = 'minmax(0, 1fr)';
        if (status) status.style.gridColumn = '1';
        if (taskBoard) taskBoard.style.gridColumn = '1';
        if (aside) aside.style.gridColumn = '1';
      } else {
        grid.style.gridTemplateColumns = 'minmax(0, 1fr) minmax(300px, 360px)';
        if (status) status.style.gridColumn = '1 / -1';
        if (taskBoard) taskBoard.style.gridColumn = '1';
        if (aside) aside.style.gridColumn = '2';
      }
    };
    syncLayout();
    if (!window.__ieltsLayoutListener) {
      window.__ieltsLayoutListener = true;
      window.addEventListener('resize', syncLayout);
    }
  }

  let queued = false;
  function enhance() {
    if (queued) return; queued = true;
    requestAnimationFrame(() => { queued = false; renderStatusArea(); setupDurationEditing(); setupDragging(); });
  }
  const root = document.getElementById('root'); if (root) new MutationObserver(enhance).observe(root, { childList: true, subtree: true });
  document.addEventListener('click', (e) => { if (!e.target.closest('.status-card')) document.querySelectorAll('.status-options').forEach((x) => x.hidden = true); });
  enhance();
})();
