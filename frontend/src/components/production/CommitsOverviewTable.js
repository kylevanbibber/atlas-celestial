import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api';
import './CommitsOverviewTable.css';

const CommitsOverviewTable = ({ currentDate }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState('lagnname');
  const [sortDir, setSortDir] = useState('asc');

  // Calculate month start/end from currentDate
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const endDate = new Date(year, month + 1, 0); // last day of month
  const endStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/commits/org-overview?start=${startStr}&end=${endStr}`);
      if (res.data?.success) {
        setData(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching commits overview:', err);
    } finally {
      setLoading(false);
    }
  }, [startStr, endStr]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'lagnname' ? 'asc' : 'desc');
    }
  };

  const sorted = [...data].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];
    // Treat null as -1 for numeric fields so they sort to bottom
    if (['hires', 'codes', 'vips'].includes(sortField)) {
      aVal = aVal ?? -1;
      bVal = bVal ?? -1;
    }
    if (typeof aVal === 'string') aVal = aVal.toLowerCase();
    if (typeof bVal === 'string') bVal = bVal.toLowerCase();
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  // lagnname is LAST FIRST MIDDLE SUFFIX — get first letter of the first name (second word)
  const getInitial = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    return parts[1]?.[0]?.toUpperCase() || parts[0]?.[0]?.toUpperCase() || '?';
  };

  const arrow = (field) => {
    if (sortField !== field) return '';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  };

  const renderVal = (val) => {
    if (val === null || val === undefined) return <span className="no-commit">—</span>;
    return Number(val).toLocaleString();
  };

  if (loading) {
    return (
      <div className="commits-overview-loading">
        <div className="spinner" />
        Loading commits...
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="commits-overview-empty">
        No active managers found for this period.
      </div>
    );
  }

  // Summary row
  const totals = data.reduce(
    (acc, row) => ({
      hires: acc.hires + (row.hires || 0),
      codes: acc.codes + (row.codes || 0),
      vips: acc.vips + (row.vips || 0)
    }),
    { hires: 0, codes: 0, vips: 0 }
  );

  return (
    <div className="commits-overview">
      <div className="commits-overview-table-wrapper">
        <table className="commits-overview-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('lagnname')} style={{ cursor: 'pointer' }}>
                MGA{arrow('lagnname')}
              </th>
              <th onClick={() => handleSort('rga')} style={{ cursor: 'pointer' }}>
                RGA{arrow('rga')}
              </th>
              <th className="numeric" onClick={() => handleSort('hires')} style={{ cursor: 'pointer' }}>
                Hires{arrow('hires')}
              </th>
              <th className="numeric" onClick={() => handleSort('codes')} style={{ cursor: 'pointer' }}>
                Codes{arrow('codes')}
              </th>
              <th className="numeric" onClick={() => handleSort('vips')} style={{ cursor: 'pointer' }}>
                VIPs{arrow('vips')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.userId}>
                <td>
                  <div className="commits-overview-name-cell">
                    {row.profpic ? (
                      <img src={row.profpic} alt="" className="commits-overview-avatar" />
                    ) : (
                      <div className="commits-overview-avatar-placeholder">
                        {getInitial(row.lagnname)}
                      </div>
                    )}
                    {row.lagnname}
                  </div>
                </td>
                <td>{row.rga || '—'}</td>
                <td className={`numeric${row.hires === null ? ' no-commit' : ''}`}>
                  {renderVal(row.hires)}
                </td>
                <td className={`numeric${row.codes === null ? ' no-commit' : ''}`}>
                  {renderVal(row.codes)}
                </td>
                <td className={`numeric${row.vips === null ? ' no-commit' : ''}`}>
                  {renderVal(row.vips)}
                </td>
              </tr>
            ))}
            <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border-color)' }}>
              <td colSpan={2} style={{ textAlign: 'right' }}>Totals</td>
              <td className="numeric">{totals.hires.toLocaleString()}</td>
              <td className="numeric">{totals.codes.toLocaleString()}</td>
              <td className="numeric">{totals.vips.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CommitsOverviewTable;
