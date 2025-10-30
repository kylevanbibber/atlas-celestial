import React from 'react';

const HierarchyWidget = ({
  viewingUserClname,
  userClname,
  promotionStatus,
  saPromotion,
  gaPromotion,
  hierarchySummary,
  expandedRoles,
  toggleRoleExpanded,
  getRoleAgents,
  getUserDisplayName,
  formatCurrency,
  formatFourMoRate
}) => {
  // AGT Promotion Status
  if (viewingUserClname === 'AGT') {
    return (
      <div className="oneonone-section hierarchy-section">
        <div className="section-header">
          <h2>Promotion Status</h2>
        </div>
        <div className="promotion-content">
          <div className="promotion-summary">
            <div className={`status-badge ${promotionStatus.isQualified ? 'qualified' : 'in-progress'}`}>
              {promotionStatus.isQualified ? `✓ Qualified via ${promotionStatus.metPath}` : 'In Progress'}
            </div>
          </div>
          <div className="promotion-details">
            {/* Only show the Monthly Breakdown; top badge indicates overall status */}
            {promotionStatus.monthsBreakdown && promotionStatus.monthsBreakdown.length > 0 && (
              <div className="promotion-block months-breakdown">
                <div className="promotion-title">Monthly Breakdown</div>
                <div className={`months-grid ${ (promotionStatus.isInVipWindow || promotionStatus.vipPathMet) ? 'vip' : '' }`}>
                  <div className="months-header">Month</div>
                  <div className="months-header">{ (promotionStatus.isInVipWindow || promotionStatus.vipPathMet) ? 'Gross ALP' : 'LVL_1_GROSS' }</div>
                  { !(promotionStatus.isInVipWindow || promotionStatus.vipPathMet) && (
                    <div className="months-header">LVL_1_NET</div>
                  )}
                  <div className="months-header">Tags</div>
                  {promotionStatus.monthsBreakdown
                    .filter(m => !(promotionStatus.vipPathMet && m.isCurrent))
                    .map((m, idx) => (
                    <React.Fragment key={idx}>
                      <div className={`month-cell ${m.isCurrent ? 'current' : ''}`}>{m.month}</div>
                      <div className={`month-cell ${m.isVipMet ? 'vip' : ''}`}>{formatCurrency(m.lvl1Gross)}</div>
                      { !(promotionStatus.isInVipWindow || promotionStatus.vipPathMet) && (
                        <div className="month-cell">{formatCurrency(m.lvl1Net)}</div>
                      )}
                      <div className="month-cell tags">
                        {m.isVipWindow && <span className="tag vip-window">VIP Window</span>}
                        {m.isVipMet && <span className="tag vip-met">VIP</span>}
                        {/* Hide personal tags per requirements */}
                        {/* Only show Prev 2 tag when not focusing on VIP path */}
                        {!promotionStatus.isInVipWindow && !promotionStatus.vipPathMet && m.isPrevTwo && (
                          <span className="tag prev">Prev 2</span>
                        )}
                        {m.isCurrent && <span className="tag current">Current</span>}
                        {!promotionStatus.isInVipWindow && !promotionStatus.vipPathMet && m.isCurrent && (promotionStatus.lastMonthNeededThisMonth > 0) && (
                          <span className="tag needed">Needs {formatCurrency(m.neededThis || 0)}</span>
                        )}
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
  
  // SA Promotion Status
  if (viewingUserClname === 'SA') {
    return (
      <div className="oneonone-section hierarchy-section">
        <div className="section-header">
          <h2>Promotion to GA</h2>
        </div>
        <div className="promotion-content">
          <div className="promotion-details">
            <div className="promotion-block">
              <div className="promotion-title">Two-Month Net Requirement</div>
              <div className="promotion-sub">$50,000 Level 2 Net</div>
              <div className="qualification-item">
                <span className="label">{saPromotion.prev2Key} & {saPromotion.prev1Key}:</span>
                <span className="value">{formatCurrency(saPromotion.twoMonthNet)} / {formatCurrency(50000)}</span>
              </div>
              <div className="qualification-item">
                <span className="label">Last Month ({saPromotion.prev1Key}):</span>
                <span className="value">{formatCurrency(saPromotion.prev1Value)}</span>
              </div>
              <div className="qualification-item remaining">
                <span className="label">Needed This Month:</span>
                <span className="value remaining-amount">{formatCurrency(saPromotion.neededThisMonth)}</span>
              </div>
            </div>
            <div className="promotion-block">
              <div className="promotion-title">Other Requirements</div>
              <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                <li>Have 2 direct personals</li>
                <li>Promote an SA</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // GA Promotion Status
  if (viewingUserClname === 'GA') {
    return (
      <div className="oneonone-section hierarchy-section">
        <div className="section-header">
          <h2>Promotion to MGA</h2>
        </div>
        <div className="promotion-content">
          <div className="promotion-details">
            <div className="promotion-block">
              <div className="promotion-title">Two-Month Net Requirement</div>
              <div className="promotion-sub">$120,000 Level 3 Net</div>
              <div className="qualification-item">
                <span className="label">{gaPromotion.prev2Key} & {gaPromotion.prev1Key}:</span>
                <span className="value">{formatCurrency(gaPromotion.twoMonthNet)} / {formatCurrency(120000)}</span>
              </div>
              <div className="qualification-item">
                <span className="label">Last Month ({gaPromotion.prev1Key}):</span>
                <span className="value">{formatCurrency(gaPromotion.prev1Value)}</span>
              </div>
              <div className="qualification-item remaining">
                <span className="label">Needed This Month:</span>
                <span className="value remaining-amount">{formatCurrency(gaPromotion.neededThisMonth)}</span>
              </div>
            </div>
            <div className="promotion-block">
              <div className="promotion-title">Other Requirements</div>
              <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                <li>Have 3 direct personals</li>
                <li>Promote a GA</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // MGA/RGA Hierarchy Summary
  return (
    <div className="oneonone-section hierarchy-section">
      <div className="section-header">
        <h2>Hierarchy Summary</h2>
      </div>
      
      <div className="hierarchy-content">
        <div className="hierarchy-summary">
          {Object.entries(hierarchySummary).map(([role, count]) => (
            <React.Fragment key={role}>
              <div 
                className="hierarchy-role-item"
                onClick={() => { if (['MGA','RGA'].includes(userClname)) toggleRoleExpanded(role); }}
                style={{ cursor: ['MGA','RGA'].includes(userClname) ? 'pointer' : 'default' }}
              >
                <div className="role-label">
                  {role}
                  {['MGA','RGA'].includes(userClname) && (
                    <span style={{ marginLeft: 8, fontSize: '0.85rem', color: 'var(--text-color-secondary, #666)' }}>
                      {expandedRoles[role] ? '▼' : '▶'}
                    </span>
                  )}
                </div>
                <div className="role-count">{count}</div>
              </div>
              {['MGA','RGA'].includes(userClname) && expandedRoles[role] && (
                <div style={{ padding: '0.5rem 0.75rem 0.75rem 0.75rem', borderLeft: '2px solid var(--border-color, #e0e0e0)', margin: '0.25rem 0 0.5rem 0.5rem', borderRadius: 4 }}>
                  {getRoleAgents(role).length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: `${userClname === 'RGA' ? '1fr 140px ' : '1fr ' }80px 80px 80px`, gap: '6px 12px', alignItems: 'center' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-color, #333)' }}>Agent</div>
                      {userClname === 'RGA' && (
                        <div style={{ fontWeight: 600, color: 'var(--text-color, #333)' }}>MGA</div>
                      )}
                      <div style={{ fontWeight: 600, color: 'var(--text-color, #333)', textAlign: 'right' }}>LVL 1</div>
                      <div style={{ fontWeight: 600, color: 'var(--text-color, #333)', textAlign: 'right' }}>LVL 2</div>
                      <div style={{ fontWeight: 600, color: 'var(--text-color, #333)', textAlign: 'right' }}>LVL 3</div>

                      {getRoleAgents(role).map((u, idx) => (
                        <React.Fragment key={u?.userId || u?.id || idx}>
                          <div>{getUserDisplayName(u)}</div>
                          {userClname === 'RGA' && (
                            <div style={{ color: 'var(--text-color-secondary, #666)' }}>{u?.mga || '—'}</div>
                          )}
                          <div style={{ color: 'var(--text-color-secondary, #666)', textAlign: 'right' }}>{formatFourMoRate(u?.pnp_data?.curr_mo_4mo_rate_1)}</div>
                          <div style={{ color: 'var(--text-color-secondary, #666)', textAlign: 'right' }}>{formatFourMoRate(u?.pnp_data?.curr_mo_4mo_rate_2)}</div>
                          <div style={{ color: 'var(--text-color-secondary, #666)', textAlign: 'right' }}>{formatFourMoRate(u?.pnp_data?.curr_mo_4mo_rate_3)}</div>
                        </React.Fragment>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text-color-secondary, #666)', fontSize: '0.9rem' }}>No users found</div>
                  )}
                </div>
              )}
            </React.Fragment>
          ))}
          <div className="hierarchy-total">
            <div className="role-label">Total</div>
            <div className="role-count">
              {Object.values(hierarchySummary).reduce((sum, count) => sum + count, 0)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HierarchyWidget;

