import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { FiX, FiChevronUp, FiChevronDown } from 'react-icons/fi';
import api from '../../api';
import DateRangeSelector from '../dashboard/DateRangeSelector';
import { formatLocalDate, getMondayOfWeek, getSundayOfWeek } from '../../utils/dateRangeUtils';
import './PayeeWebReport.css';

const formatCurrency = (value) => {
  const num = parseFloat(value) || 0;
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const toDateInput = (d) => {
  if (!d) return '';
  return typeof d === 'string' ? d.substring(0, 10) : '';
};

// Parse MM/DD/YY submit_date to a sortable key and short display
const parseSubmitDate = (sd) => {
  if (!sd) return { sort: '0000-00-00', display: '—' };
  const parts = sd.split('/');
  if (parts.length !== 3) return { sort: sd, display: sd };
  const [mm, dd, yy] = parts;
  const yyyy = parseInt(yy) < 50 ? `20${yy}` : `19${yy}`;
  return {
    sort: `${yyyy}-${mm}-${dd}`,
    display: `${parseInt(mm)}/${parseInt(dd)}`
  };
};

const METRICS = {
  total:     { countKey: 'total_policies',  premiumKey: 'total_premium',     label: 'Total' },
  immediate: { countKey: 'immediate_count', premiumKey: 'immediate_premium', label: 'Imm' },
  hold:      { countKey: 'hold_count',      premiumKey: 'hold_premium',      label: 'Hold' },
  released:  { countKey: 'released_count',  premiumKey: 'released_premium',  label: 'Rel' },
};

const getInitialDateRange = () => {
  const now = new Date();
  const monday = getMondayOfWeek(now);
  const sunday = getSundayOfWeek(now);
  return { start: formatLocalDate(monday), end: formatLocalDate(sunday) };
};

const PayeeWebReport = () => {
  const [dateRange, setDateRange] = useState(getInitialDateRange);
  const [dateViewMode, setDateViewMode] = useState('week');
  const [viewMode, setViewMode] = useState('summary');
  const [metric, setMetric] = useState('total');
  const [loading, setLoading] = useState(true);

  // Convenience aliases
  const startDate = dateRange.start;
  const endDate = dateRange.end;

  // Filters
  const [dateField, setDateField] = useState('submit_date');
  const [availableTrailers, setAvailableTrailers] = useState([]);
  const [selectedTrailers, setSelectedTrailers] = useState(['__blank__']);
  const [trailerDropdownOpen, setTrailerDropdownOpen] = useState(false);
  const trailerRef = useRef(null);

  // Data
  const [agents, setAgents] = useState([]);
  const [queueSummary, setQueueSummary] = useState([]);
  const [dateBreakdown, setDateBreakdown] = useState([]);

  // Sorting
  const [sortField, setSortField] = useState('total_premium');
  const [sortDir, setSortDir] = useState('desc');

  // Detail modal
  const [detailAgent, setDetailAgent] = useState(null);
  const [detailRows, setDetailRows] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Set default date range on mount (current week)
  useEffect(() => {
    const now = new Date();
    const monday = getMondayOfWeek(now);
    const sunday = getSundayOfWeek(now);
    setDateRange({ start: formatLocalDate(monday), end: formatLocalDate(sunday) });
  }, []);

  // Fetch available trailers when date range changes
  useEffect(() => {
    if (!startDate || !endDate) return;
    (async () => {
      try {
        const res = await api.get('/payeeweb/notify-trailers', { params: { start_date: startDate, end_date: endDate } });
        if (res.data?.success) setAvailableTrailers(res.data.data);
      } catch (err) {
        console.error('Error fetching trailers:', err);
      }
    })();
    setSelectedTrailers(['__blank__']);
  }, [startDate, endDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close trailer dropdown on outside click
  useEffect(() => {
    if (!trailerDropdownOpen) return;
    const handler = (e) => { if (trailerRef.current && !trailerRef.current.contains(e.target)) setTrailerDropdownOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [trailerDropdownOpen]);

  // Fetch data when date or view changes
  const fetchData = useCallback(async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    try {
      const params = { start_date: startDate, end_date: endDate, trailers: selectedTrailers.join(',') };

      if (viewMode === 'summary') {
        const [agentRes, queueRes] = await Promise.all([
          api.get('/payeeweb/agent-summary', { params }),
          api.get('/payeeweb/queue-summary', { params })
        ]);
        if (agentRes.data?.success) setAgents(agentRes.data.data);
        if (queueRes.data?.success) setQueueSummary(queueRes.data.data);
      } else {
        const [dateRes, queueRes] = await Promise.all([
          api.get('/payeeweb/agent-by-date', { params: { ...params, date_field: dateField } }),
          api.get('/payeeweb/queue-summary', { params })
        ]);
        if (dateRes.data?.success) setDateBreakdown(dateRes.data.data);
        if (queueRes.data?.success) setQueueSummary(queueRes.data.data);
      }
    } catch (err) {
      console.error('Error fetching PayeeWeb data:', err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, viewMode, dateField, selectedTrailers]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Sorting
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'agent_name' ? 'asc' : 'desc');
    }
  };

  const sortRows = (rows) => [...rows].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];
    if (typeof aVal === 'string') { aVal = aVal.toLowerCase(); bVal = (bVal || '').toLowerCase(); }
    else { aVal = parseFloat(aVal) || 0; bVal = parseFloat(bVal) || 0; }
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  // Summary totals
  const summaryTotals = useMemo(() => agents.reduce((acc, row) => {
    Object.values(METRICS).forEach(({ countKey, premiumKey }) => {
      acc[countKey] = (acc[countKey] || 0) + (parseInt(row[countKey]) || 0);
      acc[premiumKey] = (acc[premiumKey] || 0) + (parseFloat(row[premiumKey]) || 0);
    });
    return acc;
  }, {}), [agents]);

  // Queue summary helpers
  const getQueueData = (type) => queueSummary.find(q => q.queue_type === type) || { count: 0, total_premium: 0 };
  const totalCount = queueSummary.reduce((sum, q) => sum + (parseInt(q.count) || 0), 0);
  const totalPremium = queueSummary.reduce((sum, q) => sum + (parseFloat(q.total_premium) || 0), 0);

  // Pivot date breakdown into agent rows × submit_date columns
  const { byDateAgents, submitDates, byDateTotals } = useMemo(() => {
    const dateSet = new Map(); // sortKey -> display
    const agentMap = {};

    for (const row of dateBreakdown) {
      const { sort, display } = parseSubmitDate(row.date_value);
      dateSet.set(sort, { raw: row.date_value, display });

      const key = row.agent_name;
      if (!agentMap[key]) {
        agentMap[key] = { agent_name: row.agent_name, agent_id: row.agent_id, dates: {}, totals: {} };
        Object.values(METRICS).forEach(({ countKey, premiumKey }) => {
          agentMap[key].totals[countKey] = 0;
          agentMap[key].totals[premiumKey] = 0;
        });
      }
      agentMap[key].dates[sort] = row;
      Object.values(METRICS).forEach(({ countKey, premiumKey }) => {
        agentMap[key].totals[countKey] += parseInt(row[countKey]) || 0;
        agentMap[key].totals[premiumKey] += parseFloat(row[premiumKey]) || 0;
      });
    }

    // Sort dates chronologically
    const sortedDates = [...dateSet.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([sortKey, info]) => ({ sortKey, ...info }));

    const agents = Object.values(agentMap);

    // Column totals
    const colTotals = {};
    for (const d of sortedDates) {
      colTotals[d.sortKey] = {};
      Object.values(METRICS).forEach(({ countKey, premiumKey }) => {
        colTotals[d.sortKey][countKey] = 0;
        colTotals[d.sortKey][premiumKey] = 0;
      });
    }
    const grand = {};
    Object.values(METRICS).forEach(({ countKey, premiumKey }) => {
      grand[countKey] = 0;
      grand[premiumKey] = 0;
    });
    for (const agent of agents) {
      for (const d of sortedDates) {
        const cell = agent.dates[d.sortKey];
        if (cell) {
          Object.values(METRICS).forEach(({ countKey, premiumKey }) => {
            colTotals[d.sortKey][countKey] += parseInt(cell[countKey]) || 0;
            colTotals[d.sortKey][premiumKey] += parseFloat(cell[premiumKey]) || 0;
          });
        }
      }
      Object.values(METRICS).forEach(({ countKey, premiumKey }) => {
        grand[countKey] += agent.totals[countKey];
        grand[premiumKey] += agent.totals[premiumKey];
      });
    }

    return { byDateAgents: agents, submitDates: sortedDates, byDateTotals: { columns: colTotals, grand } };
  }, [dateBreakdown]);

  // Sort by-date agents
  const sortedByDateAgents = useMemo(() => {
    const { premiumKey } = METRICS[metric];
    return [...byDateAgents].sort((a, b) => {
      if (sortField === 'agent_name') {
        const cmp = a.agent_name.toLowerCase().localeCompare(b.agent_name.toLowerCase());
        return sortDir === 'asc' ? cmp : -cmp;
      }
      const aVal = a.totals[premiumKey] || 0;
      const bVal = b.totals[premiumKey] || 0;
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });
  }, [byDateAgents, metric, sortField, sortDir]);

  // Detail modal
  const openDetail = async (agentName) => {
    setDetailAgent(agentName);
    setDetailLoading(true);
    setDetailRows([]);
    try {
      const detailParams = { start_date: startDate, end_date: endDate, agent_name: agentName, trailers: selectedTrailers.join(',') };
      if (metric !== 'total') detailParams.queue_type = metric;
      const res = await api.get('/payeeweb/detail', { params: detailParams });
      if (res.data?.success) setDetailRows(res.data.data);
    } catch (err) {
      console.error('Error fetching detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const arrow = (field) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />;
  };

  const m = METRICS[metric];

  return (
    <div className="payeeweb-report">
      {/* Header */}
      <DateRangeSelector
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        viewMode={dateViewMode}
        onViewModeChange={setDateViewMode}
      />

      {/* Toggles */}
      <div className="payeeweb-toggles">
        <div className="payeeweb-toggle-group">
          <button className={viewMode === 'summary' ? 'active' : ''} onClick={() => setViewMode('summary')}>Summary</button>
          <button className={viewMode === 'bydate' ? 'active' : ''} onClick={() => setViewMode('bydate')}>By Date</button>
        </div>
        <div className="payeeweb-toggle-group">
          {Object.entries(METRICS).map(([key, { label }]) => (
            <button key={key} className={metric === key ? 'active' : ''} onClick={() => setMetric(key)}>{label}</button>
          ))}
        </div>
        {viewMode === 'bydate' && (
          <div className="payeeweb-toggle-group">
            <button className={dateField === 'submit_date' ? 'active' : ''} onClick={() => setDateField('submit_date')}>Submit Date</button>
            <button className={dateField === 'production_date' ? 'active' : ''} onClick={() => setDateField('production_date')}>Prod Date</button>
          </div>
        )}
        <div className="payeeweb-trailer-filter" ref={trailerRef}>
          <button
            className={`payeeweb-trailer-btn ${selectedTrailers.length > 0 && !(selectedTrailers.length === 1 && selectedTrailers[0] === '__blank__') ? 'has-filter' : ''}`}
            onClick={() => setTrailerDropdownOpen(o => !o)}
          >
            Trailer {selectedTrailers.length > 1 || (selectedTrailers.length === 1 && selectedTrailers[0] !== '__blank__') ? `(${selectedTrailers.length})` : '▾'}
          </button>
          {trailerDropdownOpen && (
            <div className="payeeweb-trailer-dropdown">
              <div className="trailer-actions">
                <button onClick={() => { setSelectedTrailers(['__blank__', ...availableTrailers]); }}>All</button>
                <button onClick={() => { setSelectedTrailers([]); }}>None</button>
              </div>
              <label className="trailer-option">
                <input
                  type="checkbox"
                  checked={selectedTrailers.includes('__blank__')}
                  onChange={() => setSelectedTrailers(prev =>
                    prev.includes('__blank__') ? prev.filter(x => x !== '__blank__') : [...prev, '__blank__']
                  )}
                />
                (Blank)
              </label>
              {availableTrailers.map(t => (
                <label key={t} className="trailer-option">
                  <input
                    type="checkbox"
                    checked={selectedTrailers.includes(t)}
                    onChange={() => setSelectedTrailers(prev =>
                      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
                    )}
                  />
                  {t}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="payeeweb-summary-cards">
        <div className={`payeeweb-summary-card total ${metric === 'total' ? 'selected' : ''}`} onClick={() => setMetric('total')}>
          <div className="card-label">Total</div>
          <div className="card-value">{formatCurrency(totalPremium)}</div>
          <div className="card-sub">{totalCount} policies</div>
        </div>
        <div className={`payeeweb-summary-card immediate ${metric === 'immediate' ? 'selected' : ''}`} onClick={() => setMetric('immediate')}>
          <div className="card-label">Immediate</div>
          <div className="card-value">{formatCurrency(getQueueData('immediate').total_premium)}</div>
          <div className="card-sub">{getQueueData('immediate').count || 0} policies</div>
        </div>
        <div className={`payeeweb-summary-card hold ${metric === 'hold' ? 'selected' : ''}`} onClick={() => setMetric('hold')}>
          <div className="card-label">Hold</div>
          <div className="card-value">{formatCurrency(getQueueData('hold').total_premium)}</div>
          <div className="card-sub">{getQueueData('hold').count || 0} policies</div>
        </div>
        <div className={`payeeweb-summary-card released ${metric === 'released' ? 'selected' : ''}`} onClick={() => setMetric('released')}>
          <div className="card-label">Released</div>
          <div className="card-value">{formatCurrency(getQueueData('released').total_premium)}</div>
          <div className="card-sub">{getQueueData('released').count || 0} policies</div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="payeeweb-loading">Loading...</div>
      ) : viewMode === 'summary' ? (
        /* ===== SUMMARY VIEW ===== */
        sortRows(agents).length === 0 ? (
          <div className="payeeweb-empty">No data for the selected date range.</div>
        ) : (
          <div className="payeeweb-table-wrap">
            <table className="payeeweb-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('agent_name')}>Agent {arrow('agent_name')}</th>
                  <th className="col-right" onClick={() => handleSort(m.premiumKey)}>Premium {arrow(m.premiumKey)}</th>
                  <th className="col-right" onClick={() => handleSort(m.countKey)}>Policies {arrow(m.countKey)}</th>
                </tr>
              </thead>
              <tbody>
                {sortRows(agents).map((row, i) => (
                  <tr key={i} onClick={() => openDetail(row.agent_name)} style={{ cursor: 'pointer' }}>
                    <td>
                      <span className="payeeweb-agent-name">{row.agent_name}</span>
                      {row.agent_id && <span className="payeeweb-agent-id">({row.agent_id})</span>}
                    </td>
                    <td className="col-right">{formatCurrency(row[m.premiumKey])}</td>
                    <td className="col-right">{parseInt(row[m.countKey]) || 0}</td>
                  </tr>
                ))}
                <tr className="totals-row">
                  <td><strong>Totals</strong></td>
                  <td className="col-right">{formatCurrency(summaryTotals[m.premiumKey])}</td>
                  <td className="col-right">{summaryTotals[m.countKey] || 0}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )
      ) : (
        /* ===== BY DATE VIEW ===== */
        sortedByDateAgents.length === 0 ? (
          <div className="payeeweb-empty">No data for the selected date range.</div>
        ) : (
          <div className="payeeweb-table-wrap">
            <table className="payeeweb-table payeeweb-bydate">
              <thead>
                <tr>
                  <th className="sticky-col" onClick={() => handleSort('agent_name')}>Agent {arrow('agent_name')}</th>
                  {submitDates.map(d => (
                    <th key={d.sortKey} className="col-right date-col">{d.display}</th>
                  ))}
                  <th className="col-right total-col" onClick={() => handleSort('total')}>Total {arrow('total')}</th>
                </tr>
              </thead>
              <tbody>
                {sortedByDateAgents.map((agent, i) => (
                  <tr key={i} onClick={() => openDetail(agent.agent_name)} style={{ cursor: 'pointer' }}>
                    <td className="sticky-col">
                      <span className="payeeweb-agent-name">{agent.agent_name}</span>
                    </td>
                    {submitDates.map(d => {
                      const cell = agent.dates[d.sortKey];
                      const count = cell ? (parseInt(cell[m.countKey]) || 0) : 0;
                      const premium = cell ? (parseFloat(cell[m.premiumKey]) || 0) : 0;
                      return (
                        <td key={d.sortKey} className="col-right date-cell">
                          {count > 0 ? (
                            <>
                              <span className="date-premium">{formatCurrency(premium)}</span>
                              <span className="date-count">{count}</span>
                            </>
                          ) : (
                            <span className="date-zero">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="col-right total-col date-cell">
                      <span className="date-premium">{formatCurrency(agent.totals[m.premiumKey])}</span>
                      <span className="date-count">{agent.totals[m.countKey] || 0}</span>
                    </td>
                  </tr>
                ))}
                <tr className="totals-row">
                  <td className="sticky-col"><strong>Totals</strong></td>
                  {submitDates.map(d => {
                    const col = byDateTotals.columns[d.sortKey] || {};
                    return (
                      <td key={d.sortKey} className="col-right date-cell">
                        <span className="date-premium">{formatCurrency(col[m.premiumKey])}</span>
                        <span className="date-count">{col[m.countKey] || 0}</span>
                      </td>
                    );
                  })}
                  <td className="col-right total-col date-cell">
                    <span className="date-premium">{formatCurrency(byDateTotals.grand[m.premiumKey])}</span>
                    <span className="date-count">{byDateTotals.grand[m.countKey] || 0}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Detail Modal */}
      {detailAgent && (
        <div className="payeeweb-detail-overlay" onClick={() => setDetailAgent(null)}>
          <div className="payeeweb-detail-modal" onClick={e => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setDetailAgent(null)}><FiX /></button>
            <h3>{detailAgent} — Policy Detail</h3>
            {detailLoading ? (
              <div className="payeeweb-loading">Loading...</div>
            ) : detailRows.length === 0 ? (
              <div className="payeeweb-empty">No policies found.</div>
            ) : (
              <div className="payeeweb-table-wrap">
                <table className="payeeweb-table">
                  <thead>
                    <tr>
                      <th>Policy #</th>
                      <th>Queue</th>
                      <th>Insured</th>
                      <th>LOB</th>
                      <th>App Type</th>
                      <th>Submit Date</th>
                      <th>Trailer</th>
                      <th className="col-right">Premium</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailRows.map((row, i) => (
                      <tr key={i}>
                        <td>{row.policy_number}</td>
                        <td><span className={`payeeweb-badge ${row.queue_type}`}>{row.queue_type}</span></td>
                        <td>{row.insured_name}</td>
                        <td>{row.line_of_business}</td>
                        <td>{row.app_type}</td>
                        <td>{row.submit_date}</td>
                        <td>{row.notify_trailer}</td>
                        <td className="col-right">{formatCurrency(row.annualized_premium)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PayeeWebReport;
