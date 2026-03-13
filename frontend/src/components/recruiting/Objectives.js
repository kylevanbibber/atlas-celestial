import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import api from '../../api';
import { FiChevronLeft, FiChevronRight, FiChevronDown, FiChevronUp, FiX } from 'react-icons/fi';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import './Objectives.css';

const TENURE_LABELS = { 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th+ Year' };

const MONTH_COLORS = {
  1:  '#fce4ec', // Jan - pink
  2:  '#f3e5f5', // Feb - lavender
  3:  '#e8eaf6', // Mar - periwinkle
  4:  '#e3f2fd', // Apr - light blue
  5:  '#e0f7fa', // May - cyan
  6:  '#e0f2f1', // Jun - teal
  7:  '#e8f5e9', // Jul - mint
  8:  '#f1f8e9', // Aug - lime
  9:  '#fffde7', // Sep - butter
  10: '#fff8e1', // Oct - peach
  11: '#fff3e0', // Nov - apricot
  12: '#fbe9e7', // Dec - coral
};

function isMonthPast(yr, mo) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  return yr < currentYear || (yr === currentYear && mo < currentMonth);
}

function getStatus(total, threshold, isLocked, isFuture) {
  if (total >= threshold) return { label: 'Met', className: 'obj-met' };
  if (isLocked) return { label: 'Missed', className: 'obj-missed' };
  if (isFuture) return { label: String(threshold), className: '' };
  return { label: 'Behind', className: 'obj-behind' };
}

const MGACard = ({ mga, defaultExpanded = false }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const quarterGroups = useMemo(() => {
    if (!mga?.months) return [];
    const quarters = { Q1: [], Q2: [], Q3: [], Q4: [] };
    mga.months.forEach(m => { quarters[m.quarter].push(m); });
    return Object.entries(quarters);
  }, [mga]);

  const summary = useMemo(() => {
    if (!mga?.months) return { met: 0, total: 0 };
    const met = mga.months.filter(m => m.met).length;
    return { met, total: mga.months.length };
  }, [mga]);

  return (
    <div className="mga-card">
      <div className="mga-card-header" onClick={() => setExpanded(!expanded)}>
        <div className="mga-card-info">
          <span className="mga-name">{mga.lagnname}</span>
          <span className="mga-tenure-badge">{TENURE_LABELS[mga.tenureYear] || `Year ${mga.tenureYear}`}</span>
        </div>
        <div className="mga-card-stats">
          <span className="mga-obj-value">Obj: {mga.objective}</span>
          <span className="mga-met-count">{summary.met}/{summary.total} met</span>
          {expanded ? <FiChevronUp /> : <FiChevronDown />}
        </div>
      </div>

      {expanded && (
        <div className="mga-card-body">
          <div className="mga-detail-row">
            <span>Start Date: {mga.startDate}</span>
          </div>

          <div className="objectives-table-wrapper">
            <table className="objectives-table">
              <thead>
                <tr>
                  <th>Bonus</th>
                  <th>Qualifying</th>
                  <th>Codes</th>
                  <th>VIPs</th>
                  <th>Total</th>
                  <th>75%</th>
                  <th>100%</th>
                </tr>
              </thead>
              <tbody>
                {quarterGroups.map(([quarter, months]) => (
                  <React.Fragment key={quarter}>
                    <tr className="quarter-header-row">
                      <td colSpan={7}>{quarter}</td>
                    </tr>
                    {months.map(m => {
                      const q1Past = isMonthPast(m.qualifyingMonth1.year, m.qualifyingMonth1.month);
                      const q2Past = isMonthPast(m.qualifyingMonth2.year, m.qualifyingMonth2.month);
                      const locked = q1Past && q2Past;
                      const future = !q1Past && !q2Past;
                      const threshold75 = Math.ceil(m.objective * 0.75);
                      const status75 = getStatus(m.actualTotal, threshold75, locked, future);
                      const status100 = getStatus(m.actualTotal, m.objective, locked, future);
                      return (
                        <React.Fragment key={m.bonusMonth}>
                          <tr className="month-row month-row-first">
                            <td className="bonus-month-cell" rowSpan={2} style={{ background: MONTH_COLORS[m.bonusMonth] }}>{m.bonusMonthLabel}</td>
                            <td className={`qual-month-cell${q1Past ? ' qual-past' : ''}`}>{m.qualifyingMonth1.label}</td>
                            <td className={q1Past ? 'qual-past' : ''}>{m.codesMonth1}</td>
                            <td className={q1Past ? 'qual-past' : ''}>{m.vipsMonth1}</td>
                            <td className={status100.className} rowSpan={2}>{m.actualTotal}</td>
                            <td className={status75.className} rowSpan={2}>
                              {future ? threshold75 : <>{status75.label} ({threshold75})</>}
                            </td>
                            <td className={status100.className} rowSpan={2}>
                              {future ? m.objective : <>{status100.label} ({m.objective})</>}
                              {m.isNewObjective && mga.prevObjective !== mga.objective && m.bonusMonth === mga.applyMonth && (
                                <span className="new-obj-marker" title="Objective increased"> *</span>
                              )}
                            </td>
                          </tr>
                          <tr className="month-row month-row-second">
                            <td className={`qual-month-cell${q2Past ? ' qual-past' : ''}`}>{m.qualifyingMonth2.label}</td>
                            <td className={q2Past ? 'qual-past' : ''}>{m.codesMonth2}</td>
                            <td className={q2Past ? 'qual-past' : ''}>{m.vipsMonth2}</td>
                          </tr>
                        </React.Fragment>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const CellDetail = ({ mga, month, onClose, anchorRect }) => {
  const ref = useRef(null);
  const q1Past = isMonthPast(month.qualifyingMonth1.year, month.qualifyingMonth1.month);
  const q2Past = isMonthPast(month.qualifyingMonth2.year, month.qualifyingMonth2.month);
  const locked = q1Past && q2Past;
  const future = !q1Past && !q2Past;
  const threshold75 = Math.ceil(month.objective * 0.75);
  const status75 = getStatus(month.actualTotal, threshold75, locked, future);
  const status100 = getStatus(month.actualTotal, month.objective, locked, future);

  // Position below the clicked cell
  const style = useMemo(() => {
    if (!anchorRect) return {};
    const top = anchorRect.bottom + 6;
    let left = anchorRect.left + anchorRect.width / 2 - 140;
    if (left < 8) left = 8;
    if (left + 280 > window.innerWidth) left = window.innerWidth - 288;
    return { top, left };
  }, [anchorRect]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <>
      <div className="sga-popover-backdrop" onClick={onClose} />
      <div className="sga-popover" ref={ref} style={style}>
        <div className="sga-popover-header">
          <span className="sga-popover-title">{month.bonusMonthLabel} — {mga.lagnname}</span>
          <button className="sga-popover-close" onClick={onClose}><FiX /></button>
        </div>
        <div className="sga-popover-body">
          <table className="sga-popover-table">
            <thead>
              <tr>
                <th>Qualifying</th>
                <th>Codes</th>
                <th>VIPs</th>
              </tr>
            </thead>
            <tbody>
              <tr className={q1Past ? 'qual-past' : ''}>
                <td>{month.qualifyingMonth1.label}</td>
                <td>{month.codesMonth1}</td>
                <td>{month.vipsMonth1}</td>
              </tr>
              <tr className={q2Past ? 'qual-past' : ''}>
                <td>{month.qualifyingMonth2.label}</td>
                <td>{month.codesMonth2}</td>
                <td>{month.vipsMonth2}</td>
              </tr>
            </tbody>
          </table>
          <div className="sga-popover-summary">
            <div className="sga-popover-row">
              <span>Total</span>
              <span className="font-semibold">{month.actualTotal}</span>
            </div>
            <div className="sga-popover-row">
              <span>75%</span>
              <span className={status75.className}>
                {future ? threshold75 : <>{status75.label} ({threshold75})</>}
              </span>
            </div>
            <div className="sga-popover-row">
              <span>100%</span>
              <span className={status100.className}>
                {future ? month.objective : <>{status100.label} ({month.objective})</>}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const SGATable = ({ mgas, yearSelector }) => {
  const [selected, setSelected] = useState(null); // { mgaIdx, monthIdx, rect }

  const handleCellClick = useCallback((e, mgaIdx, monthIdx) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setSelected(prev =>
      prev && prev.mgaIdx === mgaIdx && prev.monthIdx === monthIdx
        ? null
        : { mgaIdx, monthIdx, rect }
    );
  }, []);

  const handleClose = useCallback(() => setSelected(null), []);

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Recruiting Objectives</CardTitle>
          {yearSelector}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full team-leaderboard-table sga-table">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-3 pt-0 text-left text-xs font-medium text-muted-foreground">MGA</th>
                {MONTH_SHORT.map(m => (
                  <th key={m} className="pb-3 pt-0 text-center text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mgas.map((mga, mgaIdx) => (
                <tr key={mga.lagnname} className="border-b border-border hover:bg-accent transition-colors">
                  <td className="py-3 sga-mga-name">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">{mga.lagnname}</span>
                      <span className="mga-tenure-badge">{TENURE_LABELS[mga.tenureYear]}</span>
                    </div>
                  </td>
                  {mga.months.map((m, monthIdx) => {
                    const q1Past = isMonthPast(m.qualifyingMonth1.year, m.qualifyingMonth1.month);
                    const q2Past = isMonthPast(m.qualifyingMonth2.year, m.qualifyingMonth2.month);
                    const locked = q1Past && q2Past;
                    const future = !q1Past && !q2Past;
                    const status = getStatus(m.actualTotal, m.objective, locked, future);
                    const isSelected = selected?.mgaIdx === mgaIdx && selected?.monthIdx === monthIdx;
                    return (
                      <td
                        key={m.bonusMonth}
                        className={`sga-cell ${status.className} ${isSelected ? 'sga-cell-active' : ''}`}
                        onClick={(e) => handleCellClick(e, mgaIdx, monthIdx)}
                      >
                        {future ? `–/${m.objective}` : `${m.actualTotal}/${m.objective}`}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selected && (
          <CellDetail
            mga={mgas[selected.mgaIdx]}
            month={mgas[selected.mgaIdx].months[selected.monthIdx]}
            onClose={handleClose}
            anchorRect={selected.rect}
          />
        )}
      </CardContent>
    </Card>
  );
};

const Objectives = () => {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchObjectives = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.get('/recruiting-objectives', { params: { year } });
        if (response.data.success) {
          setData(response.data);
        } else {
          setError(response.data.message || 'Failed to fetch objectives');
        }
      } catch (err) {
        setError(err.response?.data?.message || 'An error occurred');
      } finally {
        setLoading(false);
      }
    };
    fetchObjectives();
  }, [year]);

  if (loading) {
    return <div className="objectives-loading">Loading objectives...</div>;
  }

  if (error) {
    return <div className="objectives-error">{error}</div>;
  }

  const isSGA = data?.userClname === 'SGA';
  const isSingleMGA = data?.mgas?.length === 1;

  const yearSelector = (
    <div className="objectives-year-selector">
      <button className="objectives-year-btn" onClick={() => setYear(y => y - 1)}>
        <FiChevronLeft />
      </button>
      <span className="objectives-year-label">{year}</span>
      <button className="objectives-year-btn" onClick={() => setYear(y => y + 1)}>
        <FiChevronRight />
      </button>
    </div>
  );

  if (isSGA) {
    return (
      <div className="objectives-container">
        {(!data?.mgas || data.mgas.length === 0) ? (
          <div className="objectives-empty">No MGA data found for {year}.</div>
        ) : (
          <SGATable mgas={data.mgas} yearSelector={yearSelector} />
        )}
      </div>
    );
  }

  return (
    <div className="objectives-container">
      <div className="objectives-header">
        <h2>Recruiting Objectives</h2>
        {yearSelector}
      </div>

      {(!data?.mgas || data.mgas.length === 0) && (
        <div className="objectives-empty">No MGA data found for {year}.</div>
      )}

      {data?.mgas?.map((mga, idx) => (
        <MGACard
          key={mga.lagnname}
          mga={mga}
          defaultExpanded={isSingleMGA || idx === 0}
        />
      ))}
    </div>
  );
};

export default Objectives;
