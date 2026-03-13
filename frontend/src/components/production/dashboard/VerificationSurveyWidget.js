/**
 * Verification Survey Widget
 *
 * Compact dashboard widget showing verification survey status summary.
 * Displays counts for Queued, Unverified, Verified, and Discrepancy statuses.
 * Filters data by viewScope (personal, mga, rga, team).
 * Plus icon opens RightDetails panel to add a new verification survey.
 */

import React, { useState, useEffect, useContext, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../../context/AuthContext';
import api from '../../../api';
import { Card, CardHeader, CardTitle, CardContent } from '../../ui/card';
import { FiShield, FiSend, FiClock, FiCheckCircle, FiXCircle, FiPlus } from 'react-icons/fi';
import RightDetails from '../../utils/RightDetails';

const fmtCur = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

const VerificationSurveyWidget = ({ viewScope, userRole, teamUserIds = [] }) => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [verifyData, setVerifyData] = useState([]);
  const [verifyClientData, setVerifyClientData] = useState([]);
  const [rightPanelData, setRightPanelData] = useState(null);

  const isAppAdmin = user?.teamRole === 'app' || user?.Role === 'Admin';
  const allowedIdsSet = useMemo(() => new Set(teamUserIds.map(id => String(id))), [teamUserIds]);

  // Fetch verification data (hierarchy IDs come from parent via teamUserIds)
  useEffect(() => {
    const fetchData = async () => {
      if (!isAppAdmin && teamUserIds.length === 0) return;
      try {
        setLoading(true);
        const [verifyRes, clientRes] = await Promise.all([
          api.get('/verify/all?archive=false'),
          api.get('/verify/verifyclient/all?archive=false')
        ]);
        if (verifyRes.data.success) {
          const allRows = Array.isArray(verifyRes.data.data) ? verifyRes.data.data : [];
          const filtered = isAppAdmin
            ? allRows
            : allRows.filter(row => row.userId != null && allowedIdsSet.has(String(row.userId)));
          setVerifyData(filtered);
        }
        if (clientRes.data.success) {
          setVerifyClientData(clientRes.data.data || []);
        }
      } catch (err) {
        console.error('VerificationSurveyWidget: Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [teamUserIds, isAppAdmin, allowedIdsSet]);

  // Compute discrepancy check (simplified)
  const hasDiscrepancies = useCallback((verifyRow, clientRow) => {
    const medicalKeys = [
      'amputation', 'anxiety_depression', 'cancer', 'cancer_senior', 'chronic_illness',
      'cirrhosis', 'diabetes', 'dui', 'er_visit', 'heart_issues', 'heart_lung',
      'high_blood_pressure', 'medications', 'oxygen', 'senior_rejected'
    ];
    for (const key of medicalKeys) {
      const agentAnswer = verifyRow[`${key}_answer`] || 'n';
      const clientAnswer = clientRow[key] || 'n';
      if (agentAnswer === 'n' && clientAnswer !== 'n') return true;
    }
    if (clientRow.account_verification === 'n') return true;
    if (clientRow.application_verification === 'n') return true;
    if (clientRow.agent_contact_request && clientRow.agent_contact_request.toLowerCase() !== 'no') return true;
    if (verifyRow.agent_ip === clientRow.client_ip) return true;
    return false;
  }, []);

  // Compute counts and premium sums
  const counts = useMemo(() => {
    let queued = 0, unverified = 0, verified = 0, discrepancy = 0;
    let queuedPremium = 0, unverifiedPremium = 0, verifiedPremium = 0, discrepancyPremium = 0;

    verifyData.forEach(row => {
      if (row.archive === 'y') return;

      const premium = parseFloat(row.total_annual_premium) || 0;
      const clientRow = verifyClientData.find(c => c.application_id === row.application_id);

      if (!clientRow) {
        if (row.status === 'Queued') {
          queued++;
          queuedPremium += premium;
        } else {
          unverified++;
          unverifiedPremium += premium;
        }
      } else {
        if (hasDiscrepancies(row, clientRow)) {
          discrepancy++;
          discrepancyPremium += premium;
        } else {
          verified++;
          verifiedPremium += premium;
        }
      }
    });

    return {
      queued, unverified, verified, discrepancy,
      queuedPremium, unverifiedPremium, verifiedPremium, discrepancyPremium,
      total: queued + unverified + verified + discrepancy,
      totalPremium: queuedPremium + unverifiedPremium + verifiedPremium + discrepancyPremium,
    };
  }, [verifyData, verifyClientData, hasDiscrepancies]);

  const handleGoToVerify = () => {
    navigate('/production?section=verification');
  };

  // Open the RightDetails panel with a new verification form
  const handleOpenNewVerification = useCallback(() => {
    setRightPanelData({
      __isVerificationDetails: true,
      isNew: true
    });
  }, []);

  const handleCloseRightPanel = useCallback(() => {
    setRightPanelData(null);
  }, []);

  const handleRightPanelSave = useCallback(async () => {
    setRightPanelData(null);
  }, []);

  if (loading) {
    return (
      <Card className="bg-card border-border" style={{ height: '100%' }}>
        <CardHeader>
          <CardTitle className="text-lg" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FiShield size={18} />
            Verification Survey
          </CardTitle>
        </CardHeader>
        <CardContent style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
          <div className="loading-spinner"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-card border-border" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <CardHeader style={{ paddingBottom: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <CardTitle className="text-lg" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FiShield size={18} />
              Verification Survey
            </CardTitle>
            <button
              onClick={handleOpenNewVerification}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: '1px solid var(--border-color, #e0e0e0)',
                color: 'var(--muted-foreground)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = 'var(--foreground)';
                e.currentTarget.style.backgroundColor = 'var(--accent, rgba(0,0,0,0.05))';
                e.currentTarget.style.borderColor = 'var(--foreground)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'var(--muted-foreground)';
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.borderColor = 'var(--border-color, #e0e0e0)';
              }}
              title="Add New Verification"
            >
              <FiPlus size={16} />
            </button>
          </div>
        </CardHeader>
        <CardContent style={{ flex: 1, padding: '0 1.5rem 1.5rem' }}>
          {/* Status Summary Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.75rem',
          }}>
            {/* Queued */}
            <div
              onClick={handleGoToVerify}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 152, 0, 0.08)',
                border: '1px solid rgba(255, 152, 0, 0.2)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255, 152, 0, 0.15)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255, 152, 0, 0.08)'; }}
            >
              <FiSend size={16} style={{ color: '#FF9800', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--foreground)', lineHeight: 1 }}>
                  {counts.queued}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>Queued</div>
                <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#FF9800', marginTop: 2 }}>{fmtCur(counts.queuedPremium)}</div>
              </div>
            </div>

            {/* Unverified */}
            <div
              onClick={handleGoToVerify}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                borderRadius: '8px',
                backgroundColor: 'rgba(108, 117, 125, 0.08)',
                border: '1px solid rgba(108, 117, 125, 0.2)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(108, 117, 125, 0.15)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(108, 117, 125, 0.08)'; }}
            >
              <FiClock size={16} style={{ color: '#6c757d', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--foreground)', lineHeight: 1 }}>
                  {counts.unverified}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>Unverified</div>
                <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#6c757d', marginTop: 2 }}>{fmtCur(counts.unverifiedPremium)}</div>
              </div>
            </div>

            {/* Verified */}
            <div
              onClick={handleGoToVerify}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                borderRadius: '8px',
                backgroundColor: 'rgba(40, 167, 69, 0.08)',
                border: '1px solid rgba(40, 167, 69, 0.2)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(40, 167, 69, 0.15)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(40, 167, 69, 0.08)'; }}
            >
              <FiCheckCircle size={16} style={{ color: '#28a745', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--foreground)', lineHeight: 1 }}>
                  {counts.verified}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>Verified</div>
                <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#28a745', marginTop: 2 }}>{fmtCur(counts.verifiedPremium)}</div>
              </div>
            </div>

            {/* Discrepancy */}
            <div
              onClick={handleGoToVerify}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                borderRadius: '8px',
                backgroundColor: counts.discrepancy > 0 ? 'rgba(220, 53, 69, 0.08)' : 'rgba(108, 117, 125, 0.04)',
                border: `1px solid ${counts.discrepancy > 0 ? 'rgba(220, 53, 69, 0.2)' : 'rgba(108, 117, 125, 0.1)'}`,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = counts.discrepancy > 0 ? 'rgba(220, 53, 69, 0.15)' : 'rgba(108, 117, 125, 0.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = counts.discrepancy > 0 ? 'rgba(220, 53, 69, 0.08)' : 'rgba(108, 117, 125, 0.04)'; }}
            >
              <FiXCircle size={16} style={{ color: counts.discrepancy > 0 ? '#dc3545' : '#6c757d', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--foreground)', lineHeight: 1 }}>
                  {counts.discrepancy}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>Discrepancy</div>
                <div style={{ fontSize: '0.65rem', fontWeight: 600, color: counts.discrepancy > 0 ? '#dc3545' : '#6c757d', marginTop: 2 }}>{fmtCur(counts.discrepancyPremium)}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* RightDetails Panel for new verification */}
      {rightPanelData && (
        <RightDetails
          data={rightPanelData}
          onSave={handleRightPanelSave}
          onClose={handleCloseRightPanel}
          fromPage="Verification"
        />
      )}
    </>
  );
};

export default VerificationSurveyWidget;
