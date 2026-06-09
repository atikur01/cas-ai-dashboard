const state = {
  email: '',
  password: '',
  token: '',
  metadata: {
    apps: [],
    countries: [],
    sources: [],
    formats: [
      { id: 1, name: 'Banner Ad' },
      { id: 2, name: 'Interstitial Ad' },
      { id: 3, name: 'Rewarded Ad' },
      { id: 4, name: 'Native Ad' },
      { id: 5, name: 'AppOpen Ad' },
      { id: 6, name: 'In Game Ad' }
    ]
  },
  selections: {
    apps: [],
    countries: [],
    sources: [],
    formats: []
  },
  reportData: [],
  reportTotals: null,
  charts: {
    trend: null,
    breakdown: null
  },
  sort: {
    column: null,
    direction: null
  },
  lastParams: {
    columns: [],
    currency: 'usd',
    calcTotal: true
  }
};

const UI = {
  authScreen: document.getElementById('auth-screen'),
  dashboardScreen: document.getElementById('dashboard-screen'),
  loginForm: document.getElementById('login-form'),
  emailInput: document.getElementById('email'),
  passwordInput: document.getElementById('password'),
  rememberMe: document.getElementById('remember-me'),
  authError: document.getElementById('auth-error'),
  userDisplay: document.getElementById('user-display'),
  btnLogout: document.getElementById('btn-logout'),
  filtersForm: document.getElementById('filters-form'),
  startDate: document.getElementById('start-date'),
  endDate: document.getElementById('end-date'),
  calcTotal: document.getElementById('calc-total'),
  btnFetch: document.getElementById('btn-fetch'),
  loader: document.getElementById('loader'),
  loaderText: document.getElementById('loader-text'),
  navBtns: document.querySelectorAll('.nav-btn'),
  tabPanes: document.querySelectorAll('.tab-pane'),
  kpiEarnings: document.getElementById('kpi-earnings'),
  kpiImpressions: document.getElementById('kpi-impressions'),
  kpiEcpm: document.getElementById('kpi-ecpm'),
  breakdownDim: document.getElementById('breakdown-dim'),
  reportTable: document.getElementById('report-table'),
  btnExport: document.getElementById('btn-export'),
  btnClearLogs: document.getElementById('btn-clear-logs'),
  logsOutput: document.getElementById('logs-output')
};

function addLog(message) {
  const timestamp = new Date().toISOString().slice(11, 19);
  UI.logsOutput.innerHTML += `[${timestamp}] ${message}\n`;
  UI.logsOutput.scrollTop = UI.logsOutput.scrollHeight;
}

function showLoader(text = 'Loading...') {
  UI.loaderText.textContent = text;
  UI.loader.classList.add('active');
}

function hideLoader() {
  UI.loader.classList.remove('active');
}

async function login(email, password, isAuto = false) {
  try {
    if (!isAuto) showLoader('Authenticating...');
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      throw new Error('Authentication failed');
    }

    const data = await response.json();
    state.email = email;
    state.password = password;
    state.token = data.access_token;

    if (UI.rememberMe.checked) {
      localStorage.setItem('cas_email', email);
      localStorage.setItem('cas_password', password);
      localStorage.setItem('cas_remember', 'true');
    } else {
      localStorage.removeItem('cas_email');
      localStorage.removeItem('cas_password');
      localStorage.removeItem('cas_remember');
    }

    addLog('Successfully authenticated with CAS.AI API.');
    UI.userDisplay.textContent = email;
    UI.authScreen.classList.remove('active');
    UI.dashboardScreen.classList.add('active');

    await fetchMetadata();
    initFilters();
    setDefaultDates();
    if (!isAuto) {
      await fetchReport();
    }
    return true;
  } catch (error) {
    addLog(`Authentication error: ${error.message}`);
    if (!isAuto) {
      UI.authError.textContent = 'Invalid credentials or connection error.';
    }
    return false;
  } finally {
    if (!isAuto) hideLoader();
  }
}

async function apiRequest(url, options = {}) {
  options.headers = options.headers || {};
  options.headers['Authorization'] = `Bearer ${state.token}`;

  let response = await fetch(url, options);

  if (response.status === 401) {
    addLog('Access token expired. Attempting automatic renewal...');
    const success = await login(state.email, state.password, true);
    if (success) {
      addLog('Token renewed successfully. Retrying request...');
      options.headers['Authorization'] = `Bearer ${state.token}`;
      response = await fetch(url, options);
    } else {
      addLog('Automatic renewal failed. Logging out...');
      logout();
      throw new Error('Session expired');
    }
  }

  return response;
}

async function fetchMetadata() {
  try {
    addLog('Fetching applications metadata...');
    const appsRes = await apiRequest('/api/mediation/apps');
    if (appsRes.ok) {
      state.metadata.apps = await appsRes.json();
    }

    addLog('Fetching countries metadata...');
    const countryRes = await apiRequest('/api/mediation/country');
    if (countryRes.ok) {
      const countryData = await countryRes.json();
      state.metadata.countries = countryData.Countries || [];
    }

    addLog('Fetching ad sources metadata...');
    const sourcesRes = await apiRequest('/api/mediation/adsources');
    if (sourcesRes.ok) {
      state.metadata.sources = await sourcesRes.json();
    }
  } catch (error) {
    addLog(`Metadata fetch warning: ${error.message}`);
  }
}

function initFilters() {
  setupMultiSelect('apps', state.metadata.apps, 'App_ID', 'Name');
  setupMultiSelect('countries', state.metadata.countries, 'Country_Id', 'Name');
  setupMultiSelect('sources', state.metadata.sources, 'AdSource_ID', 'Name');
  setupMultiSelect('formats', state.metadata.formats, 'id', 'name');
}

function setupMultiSelect(type, data, idKey, nameKey) {
  const header = document.getElementById(`${type}-header`);
  const dropdown = document.getElementById(`${type}-dropdown`);

  dropdown.innerHTML = '';
  state.selections[type] = [];
  header.textContent = `All ${type.charAt(0).toUpperCase() + type.slice(1)}`;

  if (!data || data.length === 0) {
    dropdown.innerHTML = '<div class="multi-select-item"><span>No options available</span></div>';
    return;
  }

  data.forEach(item => {
    const div = document.createElement('div');
    div.className = 'multi-select-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = item[idKey];

    const span = document.createElement('span');
    span.textContent = item[nameKey] || `ID: ${item[idKey]}`;

    div.appendChild(checkbox);
    div.appendChild(span);

    div.addEventListener('click', (e) => {
      if (e.target !== checkbox) {
        checkbox.checked = !checkbox.checked;
      }
      updateSelections(type, checkbox.value, checkbox.checked, header, data, idKey, nameKey);
    });

    checkbox.addEventListener('change', () => {
      updateSelections(type, checkbox.value, checkbox.checked, header, data, idKey, nameKey);
    });

    dropdown.appendChild(div);
  });

  header.onclick = (e) => {
    e.stopPropagation();
    document.querySelectorAll('.multi-select-container').forEach(container => {
      if (container !== header.parentElement) {
        container.classList.remove('open');
        container.querySelector('.multi-select-dropdown').classList.add('hidden');
      }
    });
    header.parentElement.classList.toggle('open');
    dropdown.classList.toggle('hidden');
  };
}

function updateSelections(type, value, isChecked, header, data, idKey, nameKey) {
  const valInt = parseInt(value) || value;
  if (isChecked) {
    if (!state.selections[type].includes(valInt)) {
      state.selections[type].push(valInt);
    }
  } else {
    state.selections[type] = state.selections[type].filter(item => item !== valInt);
  }

  if (state.selections[type].length === 0) {
    header.textContent = `All ${type.charAt(0).toUpperCase() + type.slice(1)}`;
  } else if (state.selections[type].length === 1) {
    const item = data.find(i => i[idKey] == valInt);
    header.textContent = item ? (item[nameKey] || `ID: ${item[idKey]}`) : `1 Selected`;
  } else {
    header.textContent = `${state.selections[type].length} Selected`;
  }
}

function setDefaultDates() {
  const end = new Date();
  const startYear = end.getFullYear();
  const startMonth = String(end.getMonth() + 1).padStart(2, '0');
  const endDay = String(end.getDate()).padStart(2, '0');

  UI.startDate.value = `${startYear}-${startMonth}-01`;
  UI.endDate.value = `${startYear}-${startMonth}-${endDay}`;
}

async function fetchReport(e) {
  if (e) e.preventDefault();

  const start = UI.startDate.value;
  const end = UI.endDate.value;
  const currency = 'usd';
  const calcTotal = UI.calcTotal.checked;

  if (!start || !end) {
    alert('Please select start and end dates');
    return;
  }

  showLoader('Fetching report data...');
  addLog(`Requesting report from ${start} to ${end}...`);

  const filters = [
    {
      type: 'date',
      value: { beginDate: start, endDate: end }
    }
  ];

  state.selections.apps.forEach(id => filters.push({ type: 'app', value: id }));
  state.selections.countries.forEach(id => filters.push({ type: 'country', value: id }));
  state.selections.formats.forEach(id => filters.push({ type: 'format', value: id }));
  state.selections.sources.forEach(id => filters.push({ type: 'ad_source', value: id }));

  const columns = [];
  document.querySelectorAll('.column-checkboxes input:checked').forEach(cb => {
    columns.push(cb.dataset.col);
  });

  const body = {
    filter: filters,
    columns: columns.map(col => ({ id: col })),
    calcTotal: calcTotal,
    currency: currency
  };

  try {
    const response = await apiRequest('/api/mediation/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const data = await response.json();
    state.reportData = (data && Array.isArray(data.list)) ? data.list : [];
    state.reportTotals = (data && data.totals) ? data.totals : null;
    state.lastParams.columns = columns;
    state.lastParams.currency = currency;
    state.lastParams.calcTotal = calcTotal;
    state.sort.column = null;
    state.sort.direction = null;
    addLog(`Received ${state.reportData.length} records.`);
    
    renderReport(columns, currency, calcTotal);
  } catch (error) {
    addLog(`Report fetch failed: ${error.message}`);
    alert(`Failed to fetch report data: ${error.message}`);
  } finally {
    hideLoader();
  }
}

function renderReport(columns, currency, calcTotal) {
  const thead = UI.reportTable.querySelector('thead tr');
  const tbody = UI.reportTable.querySelector('tbody');

  thead.innerHTML = '';
  tbody.innerHTML = '';

  if (state.reportData.length === 0) {
    thead.innerHTML = '<th>No Data</th>';
    tbody.innerHTML = '<tr><td>No records found matching filters.</td></tr>';
    updateKPIs([], currency, null);
    renderCharts([], columns, currency);
    return;
  }

  const columnMeta = {
    date: 'Date',
    app: 'App',
    country: 'Country',
    format: 'Format',
    ad_source: 'Ad Source',
    impressions: 'Impressions',
    observed_ecpm: 'eCPM',
    est_earnings: 'Earnings',
    dau: 'DAU',
    arpu: 'ARPU'
  };

  columns.forEach(col => {
    const th = document.createElement('th');
    th.className = 'sortable-header';
    th.textContent = columnMeta[col] || col;

    const iconSpan = document.createElement('span');
    iconSpan.className = 'sort-icon';
    if (state.sort.column === col) {
      iconSpan.textContent = state.sort.direction === 'asc' ? ' ▴' : ' ▾';
      th.classList.add('sorted');
    } else {
      iconSpan.textContent = ' ⇅';
    }
    th.appendChild(iconSpan);

    th.addEventListener('click', () => {
      handleSort(col);
    });

    thead.appendChild(th);
  });

  const currencySymbol = currency === 'euro' ? '€' : '$';

  state.reportData.forEach((row) => {
    const tr = document.createElement('tr');

    columns.forEach(col => {
      const td = document.createElement('td');
      let val = row[col];

      if (val === undefined || val === null) {
        td.textContent = '-';
      } else if (col === 'est_earnings' || col === 'arpu') {
        td.textContent = `${currencySymbol}${parseFloat(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
      } else if (col === 'observed_ecpm') {
        td.textContent = `${currencySymbol}${parseFloat(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      } else if (col === 'impressions' || col === 'dau') {
        td.textContent = parseInt(val).toLocaleString();
      } else if (col === 'app') {
        td.textContent = val;
      } else if (col === 'country') {
        const countryObj = state.metadata.countries.find(c => c.Country_Id == val);
        td.textContent = countryObj ? countryObj.Name : `Country ${val}`;
      } else if (col === 'ad_source') {
        const sourceObj = state.metadata.sources.find(s => s.AdSource_ID == val);
        td.textContent = sourceObj ? sourceObj.Name : `Source ${val}`;
      } else if (col === 'format') {
        const formatObj = state.metadata.formats.find(f => f.id == val);
        td.textContent = formatObj ? formatObj.name : `Format ${val}`;
      } else {
        td.textContent = val;
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  if (calcTotal && state.reportTotals) {
    const tr = document.createElement('tr');
    tr.className = 'total-row';

    columns.forEach(col => {
      const td = document.createElement('td');
      let val = state.reportTotals[col];

      if (col === 'date') {
        td.textContent = 'Total';
      } else if (val === undefined || val === null) {
        td.textContent = '';
      } else if (col === 'est_earnings' || col === 'arpu') {
        td.textContent = `${currencySymbol}${parseFloat(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
      } else if (col === 'observed_ecpm') {
        td.textContent = `${currencySymbol}${parseFloat(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      } else if (col === 'impressions' || col === 'dau') {
        td.textContent = parseInt(val).toLocaleString();
      } else {
        td.textContent = val;
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  }

  updateKPIs(state.reportData, currency, state.reportTotals);
  renderCharts(state.reportData, columns, currency);
}

function handleSort(col) {
  if (state.sort.column === col) {
    state.sort.direction = state.sort.direction === 'asc' ? 'desc' : 'asc';
  } else {
    state.sort.column = col;
    state.sort.direction = 'asc';
  }

  state.reportData.sort((a, b) => {
    let valA = a[col];
    let valB = b[col];

    if (valA === undefined || valA === null) return 1;
    if (valB === undefined || valB === null) return -1;

    if (col === 'country') {
      const cA = state.metadata.countries.find(c => c.Country_Id == valA);
      const cB = state.metadata.countries.find(c => c.Country_Id == valB);
      valA = cA ? cA.Name : `Country ${valA}`;
      valB = cB ? cB.Name : `Country ${valB}`;
    } else if (col === 'ad_source') {
      const sA = state.metadata.sources.find(s => s.AdSource_ID == valA);
      const sB = state.metadata.sources.find(s => s.AdSource_ID == valB);
      valA = sA ? sA.Name : `Source ${valA}`;
      valB = sB ? sB.Name : `Source ${valB}`;
    } else if (col === 'format') {
      const fA = state.metadata.formats.find(f => f.id == valA);
      const fB = state.metadata.formats.find(f => f.id == valB);
      valA = fA ? fA.name : `Format ${valA}`;
      valB = fB ? fB.name : `Format ${valB}`;
    }

    const isNumA = !isNaN(parseFloat(valA)) && isFinite(valA);
    const isNumB = !isNaN(parseFloat(valB)) && isFinite(valB);

    if (isNumA && isNumB) {
      return state.sort.direction === 'asc' ? parseFloat(valA) - parseFloat(valB) : parseFloat(valB) - parseFloat(valA);
    } else {
      const strA = String(valA);
      const strB = String(valB);
      return state.sort.direction === 'asc'
        ? strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' })
        : strB.localeCompare(strA, undefined, { numeric: true, sensitivity: 'base' });
    }
  });

  renderReport(state.lastParams.columns, state.lastParams.currency, state.lastParams.calcTotal);
}

function updateKPIs(data, currency, totals) {
  if (data.length === 0) {
    UI.kpiEarnings.textContent = '-';
    UI.kpiImpressions.textContent = '-';
    UI.kpiEcpm.textContent = '-';
    return;
  }

  const currencySymbol = currency === 'euro' ? '€' : '$';
  let totalEarnings = 0;
  let totalImpressions = 0;
  let totalEcpm = 0;

  if (totals) {
    totalEarnings = parseFloat(totals.est_earnings) || 0;
    totalImpressions = parseInt(totals.impressions) || 0;
    totalEcpm = parseFloat(totals.observed_ecpm) || 0;
  } else {
    data.forEach(row => {
      totalEarnings += parseFloat(row.est_earnings) || 0;
      totalImpressions += parseInt(row.impressions) || 0;
    });
    totalEcpm = totalImpressions > 0 ? (totalEarnings / totalImpressions) * 1000 : 0;
  }

  UI.kpiEarnings.textContent = `${currencySymbol}${totalEarnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  UI.kpiImpressions.textContent = totalImpressions.toLocaleString();
  UI.kpiEcpm.textContent = `${currencySymbol}${totalEcpm.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function renderCharts(data, columns, currency) {
  if (state.charts.trend) {
    state.charts.trend.destroy();
    state.charts.trend = null;
  }
  if (state.charts.breakdown) {
    state.charts.breakdown.destroy();
    state.charts.breakdown = null;
  }

  if (data.length === 0) return;

  if (columns.includes('date')) {
    const dailyData = {};
    data.forEach(row => {
      const d = row.date || 'Unknown';
      if (!dailyData[d]) {
        dailyData[d] = { earnings: 0, impressions: 0 };
      }
      dailyData[d].earnings += parseFloat(row.est_earnings) || 0;
      dailyData[d].impressions += parseInt(row.impressions) || 0;
    });

    const dates = Object.keys(dailyData).sort();
    const earnings = dates.map(d => dailyData[d].earnings);
    const ecpms = dates.map(d => dailyData[d].impressions > 0 ? (dailyData[d].earnings / dailyData[d].impressions) * 1000 : 0);

    const ctxTrend = document.getElementById('trend-chart').getContext('2d');
    state.charts.trend = new Chart(ctxTrend, {
      type: 'line',
      data: {
        labels: dates,
        datasets: [
          {
            label: `Earnings (${currency.toUpperCase()})`,
            data: earnings,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 2,
            tension: 0.3,
            yAxisID: 'y'
          },
          {
            label: 'eCPM',
            data: ecpms,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderWidth: 2,
            tension: 0.3,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#9ca3af' }
          },
          y: {
            position: 'left',
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#9ca3af' }
          },
          y1: {
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: { color: '#9ca3af' }
          }
        },
        plugins: {
          legend: { labels: { color: '#f3f4f6' } }
        }
      }
    });
  }

  updateBreakdownChart(data, columns);
}

function updateBreakdownChart(data, columns) {
  if (state.charts.breakdown) {
    state.charts.breakdown.destroy();
    state.charts.breakdown = null;
  }

  if (data.length === 0) return;

  const dim = UI.breakdownDim.value;
  if (!columns.includes(dim)) {
    const ctx = document.getElementById('breakdown-chart').getContext('2d');
    ctx.clearRect(0, 0, 300, 300);
    return;
  }

  const breakdownData = {};
  data.forEach(row => {
    const rawVal = row[dim];
    let key = rawVal === undefined || rawVal === null ? 'Unknown' : rawVal;

    if (dim === 'app') {
      key = rawVal;
    } else if (dim === 'country') {
      const country = state.metadata.countries.find(c => c.Country_Id == rawVal);
      key = country ? country.Name : `Country ${rawVal}`;
    } else if (dim === 'ad_source') {
      const source = state.metadata.sources.find(s => s.AdSource_ID == rawVal);
      key = source ? source.Name : `Source ${rawVal}`;
    } else if (dim === 'format') {
      const format = state.metadata.formats.find(f => f.id == rawVal);
      key = format ? format.name : `Format ${rawVal}`;
    }

    breakdownData[key] = (breakdownData[key] || 0) + (parseFloat(row.est_earnings) || 0);
  });

  const labels = Object.keys(breakdownData);
  const values = Object.values(breakdownData);

  const ctxBreakdown = document.getElementById('breakdown-chart').getContext('2d');
  state.charts.breakdown = new Chart(ctxBreakdown, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: [
          '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
          '#ec4899', '#6366f1', '#14b8a6', '#f43f5e', '#a855f7'
        ],
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#f3f4f6', boxWidth: 12, font: { size: 10 } }
        }
      }
    }
  });
}

function exportCSV() {
  if (state.reportData.length === 0) {
    alert('No data available to export');
    return;
  }

  const columns = [];
  document.querySelectorAll('.column-checkboxes input:checked').forEach(cb => {
    columns.push(cb.dataset.col);
  });

  let csvContent = columns.join(',') + '\n';

  state.reportData.forEach(row => {
    const values = columns.map(col => {
      let val = row[col];
      if (val === undefined || val === null) return '';
      if (typeof val === 'string' && val.includes(',')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    });
    csvContent += values.join(',') + '\n';
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `cas_mediation_report_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function logout() {
  state.email = '';
  state.password = '';
  state.token = '';
  UI.emailInput.value = '';
  UI.passwordInput.value = '';
  UI.authScreen.classList.add('active');
  UI.dashboardScreen.classList.remove('active');
  addLog('User logged out.');
}

UI.loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const email = UI.emailInput.value;
  const password = UI.passwordInput.value;
  login(email, password);
});

UI.filtersForm.addEventListener('submit', fetchReport);

UI.btnLogout.addEventListener('click', logout);

UI.btnExport.addEventListener('click', exportCSV);

UI.btnClearLogs.addEventListener('click', () => {
  UI.logsOutput.textContent = '';
  addLog('Logs cleared.');
});

UI.breakdownDim.addEventListener('change', () => {
  if (state.reportData.length > 0) {
    const calcTotal = UI.calcTotal.checked;
    const dataset = calcTotal ? state.reportData.slice(0, -1) : state.reportData;
    const columns = [];
    document.querySelectorAll('.column-checkboxes input:checked').forEach(cb => {
      columns.push(cb.dataset.col);
    });
    updateBreakdownChart(dataset, columns);
  }
});

UI.navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    UI.navBtns.forEach(b => b.classList.remove('active'));
    UI.tabPanes.forEach(t => t.classList.remove('active'));

    btn.classList.add('active');
    const tabId = btn.dataset.tab;
    document.getElementById(`tab-${tabId}`).classList.add('active');
  });
});

document.addEventListener('click', () => {
  document.querySelectorAll('.multi-select-container').forEach(container => {
    container.classList.remove('open');
    container.querySelector('.multi-select-dropdown').classList.add('hidden');
  });
});

document.querySelectorAll('.multi-select-container').forEach(container => {
  container.addEventListener('click', (e) => {
    e.stopPropagation();
  });
});

UI.startDate.addEventListener('click', () => {
  try {
    UI.startDate.showPicker();
  } catch (err) {}
});

UI.endDate.addEventListener('click', () => {
  try {
    UI.endDate.showPicker();
  } catch (err) {}
});

document.querySelectorAll('.column-checkboxes input').forEach(cb => {
  cb.addEventListener('change', () => {
    const col = cb.dataset.col;
    if (col === 'dau' || col === 'arpu') {
      if (cb.checked) {
        const adSource = document.querySelector('input[data-col="ad_source"]');
        const format = document.querySelector('input[data-col="format"]');
        if (adSource) adSource.checked = false;
        if (format) format.checked = false;
      }
    } else if (col === 'ad_source' || col === 'format') {
      if (cb.checked) {
        const dau = document.querySelector('input[data-col="dau"]');
        const arpu = document.querySelector('input[data-col="arpu"]');
        if (dau) dau.checked = false;
        if (arpu) arpu.checked = false;
      }
    }
  });
});

window.addEventListener('DOMContentLoaded', () => {
  const remember = localStorage.getItem('cas_remember');
  if (remember === 'true') {
    UI.rememberMe.checked = true;
    const email = localStorage.getItem('cas_email');
    const password = localStorage.getItem('cas_password');
    if (email && password) {
      UI.emailInput.value = email;
      UI.passwordInput.value = password;
      login(email, password);
    }
  }
});
