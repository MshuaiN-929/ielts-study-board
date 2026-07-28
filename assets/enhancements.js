(() => {
  const ORDER_KEY = 'ielts-board-task-order-v2';
  const STATUS_KEY = 'ielts-board-status-v2';
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
  const taskMinutes = (tile) => Number((tile.querySelector('.task-meta span')?.textContent || '').match(/·\s*(\d+)分钟/)?.[1] || 0);
  const toMin = (time) => { const [h, m] = time.split(':').map(Number); return h * 60 + m; };
  const fmt = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

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
        if (meta) meta.textContent = `${fmt(cursor)}–${fmt(cursor + duration)} · ${duration}分钟`;
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
      tools.innerHTML = '<span>↕ 按住任务拖动调整顺序</span><button type="button">恢复原计划</button>';
      tools.querySelector('button').onclick = () => {
        const data = orderData(); delete data[currentPlanDay()]; localStorage.setItem(ORDER_KEY, JSON.stringify(data)); location.reload();
      };
      heading.appendChild(tools);
    }
    document.querySelectorAll('.task-tile').forEach((tile) => {
      if (tile.dataset.dragReady) return;
      tile.dataset.dragReady = '1'; tile.draggable = true;
      const handle = document.createElement('span'); handle.className = 'drag-handle'; handle.textContent = '⋮⋮'; handle.title = '拖动任务';
      tile.insertBefore(handle, tile.firstChild);
      tile.addEventListener('dragstart', (e) => { tile.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
      tile.addEventListener('dragend', () => { tile.classList.remove('dragging'); saveOrder(); refreshTimes(); });
    });
    document.querySelectorAll('.task-grid').forEach((grid) => {
      if (grid.dataset.dropReady) return;
      grid.dataset.dropReady = '1';
      grid.addEventListener('dragover', (e) => {
        e.preventDefault();
        const dragging = document.querySelector('.task-tile.dragging'); if (!dragging) return;
        const after = [...grid.querySelectorAll('.task-tile:not(.dragging)')].find((item) => {
          const r = item.getBoundingClientRect(); return e.clientY < r.top + r.height / 2;
        });
        grid.insertBefore(dragging, after || null);
      });
    });
    restoreOrder();
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
  function renderStatusArea() {
    const board = document.querySelector('.task-board');
    if (!board || document.querySelector('.status-checkin')) return;
    const data = getTodayStatuses();
    const section = document.createElement('section');
    section.className = 'status-checkin';
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
    board.parentNode.insertBefore(section, board);

    const footer = document.querySelector('footer');
    const summary = document.createElement('section'); summary.className = 'mood-summary';
    summary.innerHTML = '<div class="mood-summary-heading"><div><p class="eyebrow">TODAY\'S MOOD MAP</p><h2>今日心情状态总览</h2></div><small>一天不是只有一种状态，变化也算记录</small></div><div class="mood-summary-grid"></div>';
    footer?.parentNode.insertBefore(summary, footer);
    updateSummary();
  }

  let queued = false;
  function enhance() {
    if (queued) return; queued = true;
    requestAnimationFrame(() => { queued = false; renderStatusArea(); setupDragging(); });
  }
  const root = document.getElementById('root'); if (root) new MutationObserver(enhance).observe(root, { childList: true, subtree: true });
  document.addEventListener('click', (e) => { if (!e.target.closest('.status-card')) document.querySelectorAll('.status-options').forEach((x) => x.hidden = true); });
  enhance();
})();
