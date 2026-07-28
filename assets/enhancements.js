(() => {
  const STATUS_KEY = 'ielts-board-status-v2';
  const DURATION_KEY = 'ielts-board-task-duration-v1';
  const ORDER_KEY = 'ielts-board-task-order-v3';
  const SESSION_START = { morning: '09:00', afternoon: '13:00', evening: '19:00' };
  const SESSION_NAMES = { morning: '上午', afternoon: '下午', evening: '晚上' };
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
  const taskMinutes = (tile) => Number(tile.dataset.taskMinutes || tile.dataset.originalMinutes || 0);
  const toMin = (time) => { const [h, m] = time.split(':').map(Number); return h * 60 + m; };
  const fmt = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  const sessionOfBlock = (block) => ['morning', 'afternoon', 'evening'].find((id) => block?.classList.contains(id));
  const sessionOfTile = (tile) => sessionOfBlock(tile.closest('.session-block'));
  const grids = () => Object.fromEntries([...document.querySelectorAll('.session-block')].map((block) => [sessionOfBlock(block), block.querySelector('.task-grid')]).filter(([id, grid]) => id && grid));

  function ensureOriginalMinutes(tile) {
    if (tile.dataset.originalMinutes) return;
    const text = tile.querySelector('.task-meta > span')?.textContent || '';
    const found = Number(text.match(/·\s*(\d+)分钟/)?.[1] || 0);
    tile.dataset.originalMinutes = String(found);
    tile.dataset.taskMinutes = String(found);
  }

  function refreshTimes() {
    document.querySelectorAll('.session-block').forEach((block) => {
      const session = sessionOfBlock(block);
      if (!session) return;
      let cursor = toMin(SESSION_START[session]);
      const tiles = [...block.querySelectorAll('.task-grid > .task-tile')];
      tiles.forEach((tile) => {
        ensureOriginalMinutes(tile);
        const duration = taskMinutes(tile);
        const meta = tile.querySelector('.task-meta > span');
        if (meta) meta.textContent = `${fmt(cursor)}–${fmt(cursor + duration)} · ${duration}分钟 ✎`;
        cursor += duration;
      });
      const counter = block.querySelector('.session-heading > small');
      if (counter) counter.textContent = `${tiles.filter((tile) => tile.classList.contains('done')).length}/${tiles.length}`;
    });
  }

  function durationData() { return parseJSON(localStorage.getItem(DURATION_KEY), {}); }
  function durationKey(tile) { return `${currentPlanDay()}:${taskName(tile)}`; }
  function saveDuration(tile, minutes) {
    const all = durationData();
    const key = durationKey(tile);
    if (minutes === Number(tile.dataset.originalMinutes)) delete all[key]; else all[key] = minutes;
    localStorage.setItem(DURATION_KEY, JSON.stringify(all));
  }
  function applySavedDurations() {
    const all = durationData();
    document.querySelectorAll('.task-tile').forEach((tile) => {
      ensureOriginalMinutes(tile);
      const saved = Number(all[durationKey(tile)] || 0);
      tile.dataset.taskMinutes = String(saved > 0 ? saved : Number(tile.dataset.originalMinutes));
    });
  }
  function updatePlanDurationLabel() {
    const heading = document.querySelector('.task-board .board-heading');
    if (!heading) return;
    const total = [...document.querySelectorAll('.task-tile')].reduce((sum, tile) => sum + taskMinutes(tile), 0);
    const hours = Math.floor(total / 60); const minutes = total % 60;
    const text = hours ? `${hours}小时${minutes ? `${minutes}分钟` : ''}` : `${minutes}分钟`;
    let label = heading.querySelector('.adjusted-plan-time');
    if (!label) {
      label = document.createElement('p'); label.className = 'adjusted-plan-time';
      const original = heading.querySelector(':scope > p');
      if (original) original.replaceWith(label); else heading.appendChild(label);
    }
    label.textContent = `计划 ${text} · 单词另计`;
  }
  function setupDurationEditing() {
    applySavedDurations();
    document.querySelectorAll('.task-tile').forEach((tile) => {
      const timeText = tile.querySelector('.task-meta > span');
      if (!timeText) return;
      timeText.classList.add('editable-time');
      timeText.title = '点击调整任务时长';
      if (timeText.dataset.durationReady) return;
      timeText.dataset.durationReady = '1';
      timeText.addEventListener('click', (event) => {
        event.preventDefault(); event.stopPropagation();
        const current = taskMinutes(tile); const original = Number(tile.dataset.originalMinutes || current);
        const answer = prompt(`调整“${taskName(tile)}”的时长（分钟）\n输入 5–240；输入 0 恢复原时长 ${original} 分钟。`, String(current));
        if (answer === null) return;
        const value = Number.parseInt(answer.trim(), 10);
        if (!Number.isFinite(value) || value < 0 || value > 240 || (value > 0 && value < 5)) {
          alert('请输入 5–240 之间的整数；输入 0 可恢复原时长。'); return;
        }
        const next = value === 0 ? original : value;
        tile.dataset.taskMinutes = String(next); saveDuration(tile, next);
        refreshTimes(); updatePlanDurationLabel();
      });
    });
    const heading = document.querySelector('.task-board .board-heading');
    let tools = heading?.querySelector('.duration-tools');
    if (heading && !tools) { tools = document.createElement('div'); tools.className = 'duration-tools'; heading.appendChild(tools); }
    if (tools && !tools.querySelector('.reset-durations')) {
      const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'reset-durations'; reset.textContent = '恢复原时长';
      reset.addEventListener('click', () => {
        const all = durationData(); const prefix = `${currentPlanDay()}:`;
        Object.keys(all).forEach((key) => { if (key.startsWith(prefix)) delete all[key]; });
        localStorage.setItem(DURATION_KEY, JSON.stringify(all));
        document.querySelectorAll('.task-tile').forEach((tile) => { tile.dataset.taskMinutes = tile.dataset.originalMinutes; });
        refreshTimes(); updatePlanDurationLabel();
      });
      tools.appendChild(reset);
    }
  }

  function orderData() { return parseJSON(localStorage.getItem(ORDER_KEY), {}); }
  function collectOrder() {
    return [...document.querySelectorAll('.session-block')].flatMap((block) => {
      const session = sessionOfBlock(block);
      return [...block.querySelectorAll('.task-grid > .task-tile')].map((tile) => ({ id: taskName(tile), session }));
    });
  }
  function saveOrder() {
    const all = orderData(); all[currentPlanDay()] = collectOrder();
    localStorage.setItem(ORDER_KEY, JSON.stringify(all));
  }
  function applySavedOrder() {
    const saved = orderData()[currentPlanDay()];
    if (!Array.isArray(saved) || !saved.length) return;
    const tileMap = new Map([...document.querySelectorAll('.task-tile')].map((tile) => [taskName(tile), tile]));
    const map = grids();
    saved.forEach(({ id, session }) => { if (tileMap.get(id) && map[session]) map[session].appendChild(tileMap.get(id)); });
  }
  function closeMoveMenus(except) {
    document.querySelectorAll('.move-menu').forEach((menu) => { if (menu !== except) menu.hidden = true; });
  }

  function sessionTiles(session) {
    const grid = grids()[session];
    return grid ? [...grid.querySelectorAll(':scope > .task-tile')] : [];
  }

  function renumberTasks() {
    document.querySelectorAll('.session-block').forEach((block) => {
      const tiles = [...block.querySelectorAll('.task-grid > .task-tile')];
      tiles.forEach((tile, index) => {
        let badge = tile.querySelector('.task-order-number');
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'task-order-number';
          tile.appendChild(badge);
        }
        badge.textContent = String(index + 1);
        badge.title = `本时段第 ${index + 1} 个任务`;
      });
    });
  }

  function fillPositionSelect(select, session, movingTile) {
    const tiles = sessionTiles(session).filter((tile) => tile !== movingTile);
    const currentSession = sessionOfTile(movingTile);
    const currentIndex = sessionTiles(currentSession).indexOf(movingTile);
    select.innerHTML = '';
    for (let position = 1; position <= tiles.length + 1; position += 1) {
      const option = document.createElement('option');
      option.value = String(position);
      option.textContent = `任务 ${position}`;
      select.appendChild(option);
    }
    if (session === currentSession) {
      select.value = String(Math.min(currentIndex + 1, tiles.length + 1));
    } else {
      select.value = String(tiles.length + 1);
    }
  }

  function moveTileTo(tile, targetSession, targetPosition) {
    const targetGrid = grids()[targetSession];
    if (!targetGrid) return;
    const remaining = [...targetGrid.querySelectorAll(':scope > .task-tile')].filter((item) => item !== tile);
    const index = Math.max(0, Math.min(Number(targetPosition) - 1, remaining.length));
    const reference = remaining[index] || null;
    targetGrid.insertBefore(tile, reference);
    saveOrder();
    renumberTasks();
    refreshTimes();
    updatePlanDurationLabel();
    closeMoveMenus();
  }

  let appliedOrderDay = null;
  function setupMoveControls() {
    const day = currentPlanDay();
    if (appliedOrderDay !== day) {
      appliedOrderDay = day;
      applySavedOrder();
    }
    document.querySelectorAll('.task-tile').forEach((tile) => {
      if (tile.querySelector('.task-move-control')) return;
      const control = document.createElement('div');
      control.className = 'task-move-control';
      control.innerHTML = `
        <button type="button" class="move-trigger" aria-label="调整任务位置">调整位置</button>
        <div class="move-menu" hidden>
          <label><span>移到</span><select class="move-session">
            <option value="morning">上午</option>
            <option value="afternoon">下午</option>
            <option value="evening">晚上</option>
          </select></label>
          <label><span>位置</span><select class="move-position"></select></label>
          <button type="button" class="move-confirm">确认调整</button>
        </div>`;
      const menu = control.querySelector('.move-menu');
      const sessionSelect = control.querySelector('.move-session');
      const positionSelect = control.querySelector('.move-position');
      const openMenu = () => {
        const session = sessionOfTile(tile) || 'morning';
        sessionSelect.value = session;
        fillPositionSelect(positionSelect, session, tile);
      };
      sessionSelect.addEventListener('change', () => fillPositionSelect(positionSelect, sessionSelect.value, tile));
      control.querySelector('.move-confirm').addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        moveTileTo(tile, sessionSelect.value, Number(positionSelect.value));
      });
      control.querySelector('.move-trigger').addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const willOpen = menu.hidden;
        closeMoveMenus(menu);
        menu.hidden = !willOpen;
        if (willOpen) openMenu();
      });
      tile.appendChild(control);
    });
    const heading = document.querySelector('.task-board .board-heading');
    let tools = heading?.querySelector('.duration-tools');
    if (heading && !tools) { tools = document.createElement('div'); tools.className = 'duration-tools'; heading.appendChild(tools); }
    if (tools && !tools.querySelector('.reset-order')) {
      const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'reset-order'; reset.textContent = '恢复原计划';
      reset.addEventListener('click', () => {
        const all = orderData(); delete all[currentPlanDay()]; localStorage.setItem(ORDER_KEY, JSON.stringify(all)); location.reload();
      });
      tools.prepend(reset);
    }
    renumberTasks();
    refreshTimes();
  }

  const statusData = () => parseJSON(localStorage.getItem(STATUS_KEY), {});
  function getTodayStatuses() { return statusData()[dateKey()] || {}; }
  function setStatus(period, value) {
    const all = statusData(); all[dateKey()] = { ...(all[dateKey()] || {}), [period]: value };
    localStorage.setItem(STATUS_KEY, JSON.stringify(all)); updateSummary();
  }
  function updateSummary() {
    const summary = document.querySelector('.mood-summary-grid'); if (!summary) return;
    const data = getTodayStatuses();
    summary.innerHTML = PERIODS.map((p) => {
      const value = data[p.id] || { text: '还没记录', emoji: '○' };
      return `<div class="mood-summary-item"><span>${p.icon}</span><small>${p.label}</small><strong>${value.emoji} ${value.text}</strong></div>`;
    }).join('');
  }
  function syncLayout() {
    const grid = document.querySelector('.content-grid'); const taskBoard = document.querySelector('.task-board');
    const aside = document.querySelector('.record-card'); const status = document.querySelector('.status-checkin');
    if (!grid) return;
    if (window.innerWidth <= 980) {
      grid.style.gridTemplateColumns = 'minmax(0, 1fr)';
      [status, taskBoard, aside].forEach((item) => { if (item) item.style.gridColumn = '1'; });
    } else {
      grid.style.gridTemplateColumns = 'minmax(0, 1fr) minmax(300px, 360px)';
      if (status) status.style.gridColumn = '1 / -1'; if (taskBoard) taskBoard.style.gridColumn = '1'; if (aside) aside.style.gridColumn = '2';
    }
  }
  function renderStatusArea() {
    const board = document.querySelector('.task-board');
    if (!board || document.querySelector('.status-checkin')) return;
    const data = getTodayStatuses(); const section = document.createElement('section'); section.className = 'status-checkin';
    section.innerHTML = '<div class="status-title"><div><p class="eyebrow">CURRENT STATUS</p><h2>现在是什么状态？</h2></div><small>上午、中午、下午、晚上各记一次</small></div><div class="status-cards"></div>';
    const cards = section.querySelector('.status-cards');
    PERIODS.forEach((period) => {
      const selected = data[period.id] || { text: '点击记录', emoji: '＋' }; const card = document.createElement('div'); card.className = 'status-card';
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
    const contentGrid = board.parentNode; contentGrid.insertBefore(section, board);
    const footer = document.querySelector('footer'); const summary = document.createElement('section'); summary.className = 'mood-summary';
    summary.innerHTML = '<div class="mood-summary-heading"><div><p class="eyebrow">TODAY\'S MOOD MAP</p><h2>今日心情状态总览</h2></div><small>一天不是只有一种状态，变化也算记录</small></div><div class="mood-summary-grid"></div>';
    footer?.parentNode.insertBefore(summary, footer); updateSummary(); syncLayout();
  }

  function cleanupOldDrag() {
    document.querySelectorAll('.drag-handle,.task-placeholder').forEach((el) => el.remove());
    document.querySelectorAll('.task-tile').forEach((tile) => { tile.classList.remove('task-dragging-live'); tile.style.removeProperty('position'); tile.style.removeProperty('left'); tile.style.removeProperty('top'); tile.style.removeProperty('width'); tile.style.removeProperty('height'); tile.style.removeProperty('z-index'); tile.style.removeProperty('pointer-events'); });
  }

  let queued = false;
  function enhance() {
    if (queued) return; queued = true;
    requestAnimationFrame(() => {
      queued = false; cleanupOldDrag(); renderStatusArea(); setupDurationEditing(); setupMoveControls(); syncLayout();
    });
  }
  const root = document.getElementById('root'); if (root) new MutationObserver(enhance).observe(root, { childList: true, subtree: true });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.status-card')) document.querySelectorAll('.status-options').forEach((x) => x.hidden = true);
    if (!event.target.closest('.task-move-control')) closeMoveMenus();
  });
  window.addEventListener('resize', syncLayout);
  enhance();
})();
