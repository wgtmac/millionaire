(function () {
  const defaultFund = {
    code: '000979',
    name: '景顺长城沪港深精选股票A',
    records: window.STOCK_RECORDS || [],
  };

  const funds = (window.STOCK_FUNDS && window.STOCK_FUNDS.length ? window.STOCK_FUNDS : [defaultFund]).map(
    (fund) => {
      const records = (fund.records || []).map((record, index) => ({
        index,
        date: record.date,
        nav: Number(record.nav),
        change: Number(record.change),
        ma30: null,
        ma60: null,
      }));
      const movingAverage = ChartHelpers.computeMovingAverageSeries(
        records.map((record) => record.nav),
        [30, 60],
      );
      records.forEach((record, index) => {
        record.ma30 = movingAverage[30][index];
        record.ma60 = movingAverage[60][index];
      });

      return {
        code: fund.code || defaultFund.code,
        name: fund.name || `基金 ${fund.code || defaultFund.code}`,
        records,
      };
    },
  );

  const summaryEl = document.getElementById('summary');
  const detailGridEl = document.getElementById('detailGrid');
  const tableBodyEl = document.getElementById('tableBody');
  const tooltipEl = document.getElementById('tooltip');
  const canvas = document.getElementById('chart');
  const chartWrap = document.getElementById('chartWrap');
  const rangeGroup = document.getElementById('rangeGroup');
  const ma60ToggleEl = document.getElementById('ma60Toggle');
  const titleEl = document.getElementById('fundTitle');
  const subtitleEl = document.getElementById('fundSubtitle');
  const fundPagerEl = document.getElementById('fundPager');

  const rangeModes = [
    { id: 'all', label: '全部', count: null },
    { id: '180', label: '180 日', count: 180 },
    { id: '120', label: '120 日', count: 120 },
    { id: '60', label: '60 日', count: 60 },
    { id: '30', label: '30 日', count: 30 },
  ];

  const state = {
    activeFundIndex: 0,
    selectedIndex: 0,
    hoverIndex: null,
    visibleMode: 'all',
    showMa60: false,
  };

  function activeFund() {
    return funds[state.activeFundIndex] || funds[0] || defaultFund;
  }

  function currentRecords() {
    return activeFund().records || [];
  }

  function formatDateLabel(date) {
    return date;
  }

  function formatNav(value) {
    return Number(value).toFixed(4);
  }

  function formatMa(value) {
    return value == null ? '—' : Number(value).toFixed(4);
  }

  function formatChange(value) {
    const prefix = value > 0 ? '+' : '';
    return `${prefix}${Number(value).toFixed(2)}%`;
  }

  function formatSignedNumber(value) {
    const prefix = value > 0 ? '+' : '';
    return `${prefix}${Number(value).toFixed(4)}`;
  }

  function changeClass(value) {
    if (value > 0) return 'up';
    if (value < 0) return 'down';
    return 'flat';
  }

  function latestRecord() {
    const records = currentRecords();
    return records[records.length - 1];
  }

  function minMax() {
    const records = currentRecords();
    let min = Infinity;
    let max = -Infinity;
    for (const record of records) {
      min = Math.min(min, record.nav);
      max = Math.max(max, record.nav);
      if (record.ma30 != null) {
        min = Math.min(min, record.ma30);
        max = Math.max(max, record.ma30);
      }
      if (record.ma60 != null) {
        min = Math.min(min, record.ma60);
        max = Math.max(max, record.ma60);
      }
    }
    return { min, max };
  }

  function visibleRange() {
    const records = currentRecords();
    const mode = rangeModes.find((item) => item.id === state.visibleMode) || rangeModes[0];
    if (records.length === 0) {
      return { start: 0, end: 0 };
    }
    if (!mode.count || mode.count >= records.length) {
      return { start: 0, end: records.length - 1 };
    }
    return { start: Math.max(0, records.length - mode.count), end: records.length - 1 };
  }

  function buildSummary() {
    const records = currentRecords();
    const latest = latestRecord();
    if (!latest) {
      summaryEl.innerHTML = '';
      return;
    }
    const { min, max } = minMax();
    const latestMa30 = latest.ma30;
    const latestMa60 = latest.ma60;
    const latestGap = latestMa30 == null ? null : latest.nav - latestMa30;
    const items = [
      { label: '最新日期', value: formatDateLabel(latest.date), note: '最新一个交易日' },
      { label: '最新净值', value: formatNav(latest.nav), note: '收盘后净值' },
      { label: '30 日均线', value: formatMa(latestMa30), note: '默认显示' },
      { label: '60 日均线', value: formatMa(latestMa60), note: '可切换显示' },
      { label: '偏离 30 日', value: latestGap == null ? '—' : formatSignedNumber(latestGap), note: '净值 - 30 日均线' },
      { label: '区间高低', value: `${formatNav(max)} / ${formatNav(min)}`, note: '全样本范围' },
      { label: '数据点数', value: String(records.length), note: 'OCR 识别整理' },
    ];

    summaryEl.innerHTML = items
      .map(
        (item) => `
          <div class="stat">
            <div class="stat-label">${item.label}</div>
            <div class="stat-value">${item.value}</div>
            <div class="stat-note">${item.note}</div>
          </div>
        `,
      )
      .join('');
  }

  function updateHeader() {
    const fund = activeFund();
    titleEl.textContent = fund.name;
    subtitleEl.textContent = `代码 ${fund.code} · 均线按交易日滚动计算`;
    document.title = `${fund.name} - 均线图`;
  }

  function buildFundPager() {
    fundPagerEl.innerHTML = '';
    if (funds.length <= 1) {
      fundPagerEl.hidden = true;
      return;
    }

    fundPagerEl.hidden = false;
    funds.forEach((fund, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'fund-page-btn';
      button.textContent = `${index + 1}. ${fund.name}`;
      button.title = fund.name;
      button.setAttribute('aria-pressed', String(index === state.activeFundIndex));
      button.addEventListener('click', () => {
        state.activeFundIndex = index;
        state.selectedIndex = currentRecords().length - 1;
        state.hoverIndex = null;
        updateHeader();
        updateFundPager();
        buildSummary();
        buildTable();
        hideTooltip();
        render();
      });
      fundPagerEl.appendChild(button);
    });
  }

  function updateFundPager() {
    for (const [index, button] of [...fundPagerEl.querySelectorAll('button')].entries()) {
      button.setAttribute('aria-pressed', String(index === state.activeFundIndex));
    }
  }

  function buildRangeButtons() {
    rangeGroup.innerHTML = '';
    for (const mode of rangeModes) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'range-btn';
      button.textContent = mode.label;
      button.setAttribute('aria-pressed', String(mode.id === state.visibleMode));
      button.addEventListener('click', () => {
        state.visibleMode = mode.id;
        updateRangeButtons();
        render();
      });
      rangeGroup.appendChild(button);
    }
  }

  function updateRangeButtons() {
    for (const button of rangeGroup.querySelectorAll('button')) {
      const mode = rangeModes.find((item) => item.label === button.textContent);
      button.setAttribute('aria-pressed', String(mode && mode.id === state.visibleMode));
    }
  }

  function updateMa60Toggle() {
    ma60ToggleEl.setAttribute('aria-pressed', String(state.showMa60));
  }

  function buildDetails(record) {
    if (!record) {
      detailGridEl.innerHTML = '';
      return;
    }

    const gap = record.ma30 == null ? null : record.nav - record.ma30;
    const items = [
      { label: '日期', value: record.date },
      { label: '净值', value: formatNav(record.nav) },
      {
        label: '日涨幅',
        value: formatChange(record.change),
        className: changeClass(record.change),
      },
      { label: '30 日均线', value: formatMa(record.ma30) },
      { label: '60 日均线', value: formatMa(record.ma60) },
      {
        label: '偏离 30 日',
        value: gap == null ? '—' : formatSignedNumber(gap),
        className: gap == null ? 'flat' : gap >= 0 ? 'up' : 'down',
      },
    ];

    detailGridEl.innerHTML = items
      .map(
        (item) => `
          <div class="detail-item">
            <div class="detail-label">${item.label}</div>
            <div class="detail-value ${item.className || ''}">${item.value}</div>
          </div>
        `,
      )
      .join('');
  }

  function buildTable() {
    const records = currentRecords();
    tableBodyEl.innerHTML = '';
    const fragment = document.createDocumentFragment();

    records.forEach((record) => {
      const tr = document.createElement('tr');
      tr.dataset.index = String(record.index);
      tr.innerHTML = `
        <td class="num">${record.date}</td>
        <td class="num">${formatNav(record.nav)}</td>
        <td class="num ${changeClass(record.change)}">${formatChange(record.change)}</td>
        <td class="num">${formatMa(record.ma30)}</td>
        <td class="num">${formatMa(record.ma60)}</td>
      `;
      tr.addEventListener('click', () => {
        state.selectedIndex = record.index;
        syncSelection();
        render();
        tr.scrollIntoView({ block: 'nearest' });
      });
      fragment.appendChild(tr);
    });

    tableBodyEl.appendChild(fragment);
  }

  function syncSelection() {
    for (const row of tableBodyEl.querySelectorAll('tr')) {
      row.classList.toggle('selected', Number(row.dataset.index) === state.selectedIndex);
    }
  }

  function getActiveIndex() {
    const { start, end } = visibleRange();
    const candidate = state.hoverIndex != null ? state.hoverIndex : state.selectedIndex;
    if (candidate == null) return end;
    return Math.max(start, Math.min(end, candidate));
  }

  function drawSeries(ctx, layout, values, visible, color, width) {
    let started = false;
    ctx.beginPath();
    for (let i = visible.start; i <= visible.end; i += 1) {
      const value = values[i];
      if (value == null) {
        started = false;
        continue;
      }
      const x = layout.x(i);
      const y = layout.y(value);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  function renderTooltip(index, x, y) {
    const records = currentRecords();
    const record = records[index];
    if (!record) return;
    const gap = record.ma30 == null ? null : record.nav - record.ma30;
    tooltipEl.innerHTML = `
      <div class="tooltip-title">${record.date}</div>
      <div class="tooltip-row"><span>净值</span><strong>${formatNav(record.nav)}</strong></div>
      <div class="tooltip-row"><span>日涨幅</span><strong class="${changeClass(record.change)}">${formatChange(record.change)}</strong></div>
      <div class="tooltip-row"><span>30 日均线</span><strong>${formatMa(record.ma30)}</strong></div>
      <div class="tooltip-row"><span>60 日均线</span><strong>${formatMa(record.ma60)}</strong></div>
      <div class="tooltip-row"><span>偏离 30 日</span><strong class="${gap == null ? 'flat' : gap >= 0 ? 'up' : 'down'}">${gap == null ? '—' : formatSignedNumber(gap)}</strong></div>
    `;

    tooltipEl.classList.remove('hidden');
    const wrapRect = chartWrap.getBoundingClientRect();
    const tooltipRect = tooltipEl.getBoundingClientRect();
    const offset = 14;
    let left = x + offset;
    let top = y + offset;
    if (left + tooltipRect.width > wrapRect.width) {
      left = x - tooltipRect.width - offset;
    }
    if (top + tooltipRect.height > wrapRect.height) {
      top = y - tooltipRect.height - offset;
    }
    tooltipEl.style.left = `${Math.max(8, left)}px`;
    tooltipEl.style.top = `${Math.max(8, top)}px`;
  }

  function hideTooltip() {
    tooltipEl.classList.add('hidden');
  }

  function renderChart() {
    const records = currentRecords();
    const ctx = canvas.getContext('2d');
    const wrapRect = chartWrap.getBoundingClientRect();
    const width = Math.max(320, Math.floor(wrapRect.width));
    const height = Math.max(280, Math.floor(canvas.getBoundingClientRect().height));
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const layout = {
      left: 62,
      right: 22,
      top: 18,
      bottom: 38,
    };
    layout.width = width;
    layout.height = height;
    layout.plotWidth = width - layout.left - layout.right;
    layout.plotHeight = height - layout.top - layout.bottom;

    const visible = visibleRange();
    const visibleRecords = records.slice(visible.start, visible.end + 1);
    const rawValues = visibleRecords.map((record) => record.nav);
    const maValues = visibleRecords
      .flatMap((record) => [record.ma30, state.showMa60 ? record.ma60 : null])
      .filter((value) => value != null);
    const combined = rawValues.concat(maValues);
    const min = Math.min(...combined);
    const max = Math.max(...combined);
    const padding = (max - min) * 0.08 || 0.1;
    const yMin = min - padding;
    const yMax = max + padding;
    const xCount = Math.max(visible.end - visible.start, 1);
    const xStep = layout.plotWidth / xCount;

    layout.x = (index) => layout.left + (index - visible.start) * xStep;
    layout.y = (value) => {
      const ratio = (value - yMin) / (yMax - yMin);
      return layout.top + layout.plotHeight - ratio * layout.plotHeight;
    };

    const bg = '#ffffff';
    const grid = '#e7edf5';
    const axis = '#9aa4b2';

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    if (records.length === 0) {
      ctx.fillStyle = axis;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('暂无数据', width / 2, height / 2);
      hideTooltip();
      return;
    }

    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif';
    ctx.fillStyle = axis;
    ctx.textBaseline = 'middle';

    for (let i = 0; i <= 4; i += 1) {
      const value = yMax - ((yMax - yMin) * i) / 4;
      const y = layout.y(value);
      ctx.beginPath();
      ctx.moveTo(layout.left, y);
      ctx.lineTo(width - layout.right, y);
      ctx.stroke();
      ctx.fillText(value.toFixed(2), 10, y);
    }

    const ticks = [];
    let lastMonth = '';
    for (let i = visible.start; i <= visible.end; i += 1) {
      const month = records[i].date.slice(0, 7);
      if (i === visible.start || i === visible.end || month !== lastMonth) {
        ticks.push(i);
        lastMonth = month;
      }
    }
    ticks.sort((a, b) => a - b);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const index of ticks) {
      const x = layout.x(index);
      ctx.beginPath();
      ctx.moveTo(x, layout.top);
      ctx.lineTo(x, height - layout.bottom);
      ctx.strokeStyle = '#f3f6fa';
      ctx.stroke();

      const label = records[index].date.slice(0, 7);
      ctx.fillStyle = axis;
      ctx.fillText(label, x, height - layout.bottom + 10);
    }

    const rawPathColor = '#2563eb';
    const ma30PathColor = '#d97706';
    const ma60PathColor = '#0f766e';
    drawSeries(ctx, layout, records.map((record) => record.nav), visible, rawPathColor, 2.2);
    drawSeries(ctx, layout, records.map((record) => record.ma30), visible, ma30PathColor, 2.6);
    if (state.showMa60) {
      drawSeries(ctx, layout, records.map((record) => record.ma60), visible, ma60PathColor, 2.6);
    }

    const active = getActiveIndex();
    const activeRecord = records[active];
    if (activeRecord) {
      const x = layout.x(active);
      ctx.strokeStyle = 'rgba(37, 99, 235, 0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, layout.top);
      ctx.lineTo(x, height - layout.bottom);
      ctx.stroke();

      const points = [
        { value: activeRecord.nav, color: rawPathColor },
        { value: activeRecord.ma30, color: ma30PathColor },
        { value: state.showMa60 ? activeRecord.ma60 : null, color: ma60PathColor },
      ];
      for (const point of points) {
        if (point.value == null) continue;
        const px = layout.x(active);
        const py = layout.y(point.value);
        ctx.beginPath();
        ctx.arc(px, py, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.strokeStyle = point.color;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    if (state.hoverIndex != null) {
      const hoverRecord = records[state.hoverIndex];
      if (hoverRecord) {
        const hoverX = layout.x(state.hoverIndex);
        const hoverY = layout.y(hoverRecord.nav);
        renderTooltip(state.hoverIndex, hoverX + 8, hoverY - 8);
      }
    } else {
      hideTooltip();
    }
  }

  function renderDetailPanel() {
    const records = currentRecords();
    const active = state.hoverIndex != null ? state.hoverIndex : state.selectedIndex;
    buildDetails(records[active]);
  }

  function render() {
    syncSelection();
    renderDetailPanel();
    renderChart();
  }

  function pointFromEvent(event) {
    const records = currentRecords();
    if (records.length === 0) return 0;
    const rect = canvas.getBoundingClientRect();
    const { start, end } = visibleRange();
    const modeCount = end - start + 1;
    if (modeCount <= 1) return start;
    const layoutLeft = 62;
    const layoutRight = 22;
    const plotWidth = rect.width - layoutLeft - layoutRight;
    const x = event.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, (x - layoutLeft) / plotWidth));
    const index = Math.round(start + ratio * (modeCount - 1));
    return Math.max(start, Math.min(end, index));
  }

  canvas.addEventListener('mousemove', (event) => {
    state.hoverIndex = pointFromEvent(event);
    renderChart();
  });

  canvas.addEventListener('mouseleave', () => {
    state.hoverIndex = null;
    renderChart();
  });

  canvas.addEventListener('click', (event) => {
    state.selectedIndex = pointFromEvent(event);
    syncSelection();
    renderDetailPanel();
    renderChart();
  });

  ma60ToggleEl.addEventListener('click', () => {
    state.showMa60 = !state.showMa60;
    updateMa60Toggle();
    renderChart();
  });

  window.addEventListener('resize', () => {
    renderChart();
  });

  state.selectedIndex = currentRecords().length - 1;
  updateHeader();
  buildFundPager();
  buildSummary();
  buildRangeButtons();
  updateMa60Toggle();
  buildTable();
  render();
})();
