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
    label.textContent = `调整后计划 ${text} · 单词按实际时间另计`;
  }
  function setupDurationEditing() {
    applySavedDurations();
    document.querySelectorAll('.task-tile').forEach((tile) => {
      const meta = tile.querySelector('.task-meta');
      const timeText = meta?.querySelector(':scope > span');
      if (!meta || !timeText) return;
      let button = meta.querySelector('.duration-edit');
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'duration-edit';
        button.title = '点击调整任务时长';
        button.setAttribute('aria-label', `调整${taskName(tile)}的时长`);
        meta.appendChild(button);
        const edit = (event) => {
          event.preventDefault();
          event.stopPropagation();
          const current = taskMinutes(tile);
          const original = Number(tile.dataset.originalMinutes || current);
          const answer = window.prompt(`调整“${taskName(tile)}”的时长（分钟）
填写 5–240；输入 0 恢复原时长 ${original} 分钟。`, String(current));
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
        button.addEventListener('pointerdown', (event) => { event.stopPropagation(); });
        button.addEventListener('click', edit);
      }
      button.textContent = `${taskMinutes(tile)}分钟 ✎`;
    });

    const tools = document.querySelector('.reorder-tools');
    if (tools && !tools.querySelector('.reset-durations')) {
      const reset = document.createElement('button');
      reset.type = 'button';
      reset.className = 'reset-durations';
      reset.textContent = '恢复原时长';
      reset.addEventListener('click', (event) => {
        event.preventDefault();
        const all = durationData();
        const prefix = `${currentPlanDay()}:`;
        Object.keys(all).forEach((key) => { if (key.startsWith(prefix)) delete all[key]; });
        localStorage.setItem(DURATION_KEY, JSON.stringify(all));
        document.querySelectorAll('.task-tile').forEach((tile) => {
          tile.dataset.taskMinutes = tile.dataset.originalMinutes || tile.dataset.taskMinutes;
        });
        refreshTimes();
        setupDurationEditing();
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
        if (meta) meta.textContent = `${fmt(cursor)}–${fmt(cursor + duration)}`;
        const durationButton = tile.querySelector('.duration-edit');
        if (durationButton) durationButton.textContent = `${duration}分钟 ✎`;
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
      tools.innerHTML = '<span>↕ 按住左侧手柄拖动任务</span><button type="button">恢复原计划</button>';
      tools.querySelector('button').onclick = () => {
        const data = orderData();
        delete data[currentPlanDay()];
        localStorage.setItem(ORDER_KEY, JSON.stringify(data));
        location.reload();
      };
      heading.appendChild(tools);
    }

    document.querySelectorAll('.task-tile').forEach((tile) => {
      if (tile.dataset.dragReady) return;
      tile.dataset.dragReady = '1';
      tile.draggable = false;

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
        if (event.button !== undefined && event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        handle.setPointerCapture?.(event.pointerId);

        const rect = tile.getBoundingClientRect();
        const placeholder = document.createElement('div');
        placeholder.className = 'task-placeholder';
        placeholder.style.height = `${rect.height}px`;
        tile.parentNode.insertBefore(placeholder, tile.nextSibling);

        const ghost = tile.cloneNode(true);
        ghost.classList.add('task-drag-ghost');
        ghost.querySelector('.drag-handle')?.remove();
        Object.assign(ghost.style, {
          width: `${rect.width}px`,
          height: `${rect.height}px`,
          left: `${rect.left}px`,
          top: `${rect.top}px`,
        });
        document.body.appendChild(ghost);
        tile.classList.add('task-drag-source');
        tile.style.display = 'none';

        const offsetX = event.clientX - rect.left;
        const offsetY = event.clientY - rect.top;
        const moveGhost = (x, y) => {
          ghost.style.left = `${x - offsetX}px`;
          ghost.style.top = `${y - offsetY}px`;
        };
        moveGhost(event.clientX, event.clientY);

        const onMove = (moveEvent) => {
          moveEvent.preventDefault();
          moveGhost(moveEvent.clientX, moveEvent.clientY);
          ghost.style.display = 'none';
          const under = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
          ghost.style.display = '';
          const targetGrid = under?.closest?.('.task-grid');
          if (!targetGrid) return;

          const items = [...targetGrid.querySelectorAll('.task-tile:not(.task-drag-source)')];
          if (!items.length) {
            targetGrid.appendChild(placeholder);
            return;
          }

          const rows = [];
          items.forEach((item) => {
            const rect = item.getBoundingClientRect();
            const centerY = rect.top + rect.height / 2;
            let row = rows.find((entry) => Math.abs(entry.centerY - centerY) < Math.min(rect.height, entry.height) * 0.38);
            if (!row) {
              row = { centerY, height: rect.height, items: [] };
              rows.push(row);
            }
            row.items.push({ item, rect, centerX: rect.left + rect.width / 2 });
          });
          rows.sort((a, b) => a.centerY - b.centerY);
          rows.forEach((row) => row.items.sort((a, b) => a.centerX - b.centerX));

          let inserted = false;
          for (const row of rows) {
            if (moveEvent.clientY < row.centerY - row.height * 0.34) {
              targetGrid.insertBefore(placeholder, row.items[0].item);
              inserted = true;
              break;
            }
            if (Math.abs(moveEvent.clientY - row.centerY) <= row.height * 0.66) {
              const beforeItem = row.items.find(({ centerX }) => moveEvent.clientX < centerX);
              if (beforeItem) targetGrid.insertBefore(placeholder, beforeItem.item);
              else targetGrid.insertBefore(placeholder, row.items[row.items.length - 1].item.nextSibling);
              inserted = true;
              break;
            }
          }
          if (!inserted) targetGrid.appendChild(placeholder);
        };

        const finish = (upEvent) => {
          upEvent?.preventDefault?.();
          handle.releasePointerCapture?.(event.pointerId);
          handle.removeEventListener('pointermove', onMove);
          handle.removeEventListener('pointerup', finish);
          handle.removeEventListener('pointercancel', finish);
          tile.style.display = '';
          placeholder.parentNode.insertBefore(tile, placeholder);
          placeholder.remove();
          ghost.remove();
          tile.classList.remove('task-drag-source');
          saveOrder();
          refreshTimes();
        };

        handle.addEventListener('pointermove', onMove);
        handle.addEventListener('pointerup', finish);
        handle.addEventListener('pointercancel', finish);
      });
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
