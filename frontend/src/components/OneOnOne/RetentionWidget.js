import React from 'react';

const RetentionWidget = ({
  retentionLoading,
  retentionData,
  userClname
}) => {
  const formatFourMoRate = (rate) => {
    if (rate === undefined || rate === null) return '—';
    const s = String(rate).trim();
    if (s.length === 0 || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') return '—';
    return s.endsWith('%') ? s : `${s}%`;
  };

  return (
    <div className="oneonone-section" style={{ gridColumn: '1 / 4' }}>
      <div className="section-header">
        <h2>Retention</h2>
      </div>
      {retentionLoading ? (
        <div className="activity-loading"><div className="spinner"></div><p>Loading retention…</p></div>
      ) : retentionData ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {userClname !== 'AGT' && (
                  <th style={{ textAlign: 'left', padding: '8px' }}>Level</th>
                )}
                <th style={{ textAlign: 'right', padding: '8px' }}>Curr Mo Net Submit</th>
                <th style={{ textAlign: 'right', padding: '8px' }}>YTD Life Net Submit</th>
                <th style={{ textAlign: 'right', padding: '8px' }}>First 6 Mo Net Submit</th>
                <th style={{ textAlign: 'right', padding: '8px' }}>First 6 YTD Net</th>
                <th style={{ textAlign: 'right', padding: '8px' }}>Curr Mo 4Mo Rate</th>
                <th style={{ textAlign: 'right', padding: '8px' }}>Proj +1 4Mo Rate</th>
                <th style={{ textAlign: 'right', padding: '8px' }}>Proj +2 4Mo Rate</th>
                <th style={{ textAlign: 'right', padding: '8px' }}>As of</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const baseKeys = (userClname === 'AGT')
                  ? ['lvl1']
                  : (userClname === 'SA')
                    ? ['lvl1','lvl2']
                    : (userClname === 'RGA')
                      ? []
                      : ['lvl1','lvl2','lvl3'];
                return baseKeys.map((k) => {
                const row = retentionData[k] || {};
                const label = k === 'lvl1' ? 'LVL 1 (-1)' : k === 'lvl2' ? 'LVL 2 (-2)' : 'LVL 3 (-3)';
                const fmtNum = (v) => {
                  if (v === null || v === undefined || v === '' || v === 'N/A') return '—';
                  const n = parseFloat(String(v).toString().replace(/[^0-9.-]/g, ''));
                  return Number.isFinite(n) ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n) : '—';
                };
                const fmtPct = (v) => {
                  if (v === null || v === undefined || v === '' || v === 'N/A') return '—';
                  const s = String(v).trim();
                  return s.endsWith('%') ? s : `${s}%`;
                };
                 return (
                  <tr key={k}>
                    {userClname !== 'AGT' && (
                      <td style={{ padding: '8px' }}>{label}</td>
                    )}
                    <td style={{ textAlign: 'right', padding: '8px' }}>{fmtNum(row.curr_mo_net_submit)}</td>
                    <td style={{ textAlign: 'right', padding: '8px' }}>{fmtNum(row.cur_ytd_life_net_submit)}</td>
                    <td style={{ textAlign: 'right', padding: '8px' }}>{fmtNum(row.first_6_mo_net_submit)}</td>
                    <td style={{ textAlign: 'right', padding: '8px' }}>{fmtNum(row.first_6_ytd_net)}</td>
                    <td style={{ textAlign: 'right', padding: '8px' }}>{fmtPct(row.curr_mo_4mo_rate)}</td>
                    <td style={{ textAlign: 'right', padding: '8px' }}>{fmtPct(row.proj_plus_1_4mo_rate)}</td>
                     <td style={{ textAlign: 'right', padding: '8px' }}>{fmtPct(row.proj_plus_2_4mo_rate)}</td>
                     <td style={{ textAlign: 'right', padding: '8px' }}>{row.date || '—'}</td>
                  </tr>
                );
                });
              })()}
              {/* RGA: LVL 3 Total only (no 4mo rates) */}
              {userClname === 'RGA' && (() => {
                const rows = Array.isArray(retentionData.rgaAll) ? retentionData.rgaAll : [];
                if (rows.length === 0) return null;
                const getSuffix = (agentNum) => String(agentNum || '').split('-').pop();
                const lvl3Rows = rows.filter(r => getSuffix(r.agent_num) === '3');
                if (lvl3Rows.length === 0) return null;
                const parseNum = (v) => {
                  const n = parseFloat(String(v || '').replace(/[^0-9.-]/g, ''));
                  return Number.isFinite(n) ? n : 0;
                };
                const fmtNum = (v) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v);
                const total = {
                  curr_mo_net_submit: lvl3Rows.reduce((s, r) => s + parseNum(r.curr_mo_net_submit), 0),
                  cur_ytd_life_net_submit: lvl3Rows.reduce((s, r) => s + parseNum(r.cur_ytd_life_net_submit), 0),
                  first_6_mo_net_submit: lvl3Rows.reduce((s, r) => s + parseNum(r.first_6_mo_net_submit), 0),
                  first_6_ytd_net: lvl3Rows.reduce((s, r) => s + parseNum(r.first_6_ytd_net), 0),
                  date: (lvl3Rows[0]?.date) || ''
                };
                return (
                  <tr key={`rga-agg-total`}>
                    <td style={{ padding: '8px' }}>{'LVL 3 (RGA Total)'}</td>
                    <td style={{ textAlign: 'right', padding: '8px' }}>{fmtNum(total.curr_mo_net_submit)}</td>
                    <td style={{ textAlign: 'right', padding: '8px' }}>{fmtNum(total.cur_ytd_life_net_submit)}</td>
                    <td style={{ textAlign: 'right', padding: '8px' }}>{fmtNum(total.first_6_mo_net_submit)}</td>
                    <td style={{ textAlign: 'right', padding: '8px' }}>{fmtNum(total.first_6_ytd_net)}</td>
                    <td style={{ textAlign: 'right', padding: '8px' }}>—</td>
                    <td style={{ textAlign: 'right', padding: '8px' }}>—</td>
                    <td style={{ textAlign: 'right', padding: '8px' }}>—</td>
                    <td style={{ textAlign: 'right', padding: '8px' }}>{total.date || '—'}</td>
                  </tr>
                );
              })()}

              {/* RGA: append all current-month rows (e.g., -3, -4, -5) */}
              {userClname === 'RGA' && Array.isArray(retentionData.rgaAll) && retentionData.rgaAll.length > 0 && (
                retentionData.rgaAll.map((row, idx) => {
                  const fmtNum = (v) => {
                    if (v === null || v === undefined || v === '' || v === 'N/A') return '—';
                    const n = parseFloat(String(v).toString().replace(/[^0-9.-]/g, ''));
                    return Number.isFinite(n) ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n) : '—';
                  };
                  const fmtPct = (v) => {
                    if (v === null || v === undefined || v === '' || v === 'N/A') return '—';
                    const s = String(v).trim();
                    return s.endsWith('%') ? s : `${s}%`;
                  };
                  const suffix = (row.agent_num || '').split('-').pop();
                  const baseFrom = String((retentionData?.lvl1?.agent_num || retentionData?.lvl2?.agent_num || '')).split('-')[0];
                  const baseThis = String(row.agent_num || '').split('-')[0];
                  const isLvl3 = suffix === '3';
                  const labelAddon = isLvl3 ? (baseFrom && baseThis === baseFrom ? ' (MGA)' : ' (RGA w/o MGA)') : '';
                  const label = `LVL ${suffix ? suffix : '?'}${labelAddon}`;
                  return (
                    <tr key={`rga-${idx}`}>
                      <td style={{ padding: '8px' }}>{label}</td>
                      <td style={{ textAlign: 'right', padding: '8px' }}>{fmtNum(row.curr_mo_net_submit)}</td>
                      <td style={{ textAlign: 'right', padding: '8px' }}>{fmtNum(row.cur_ytd_life_net_submit)}</td>
                      <td style={{ textAlign: 'right', padding: '8px' }}>{fmtNum(row.first_6_mo_net_submit)}</td>
                      <td style={{ textAlign: 'right', padding: '8px' }}>{fmtNum(row.first_6_ytd_net)}</td>
                      <td style={{ textAlign: 'right', padding: '8px' }}>{fmtPct(row.curr_mo_4mo_rate)}</td>
                      <td style={{ textAlign: 'right', padding: '8px' }}>{fmtPct(row.proj_plus_1_4mo_rate)}</td>
                      <td style={{ textAlign: 'right', padding: '8px' }}>{fmtPct(row.proj_plus_2_4mo_rate)}</td>
                      <td style={{ textAlign: 'right', padding: '8px' }}>{row.date || '—'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ color: 'var(--text-color-secondary, #666)' }}>No retention data available.</div>
      )}
    </div>
  );
};

export default RetentionWidget;

