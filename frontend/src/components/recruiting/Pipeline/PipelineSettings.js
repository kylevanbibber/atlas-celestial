import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { toast } from 'react-hot-toast';
import api from '../../../api';
import { FiCreditCard, FiShoppingCart, FiMessageCircle, FiFileText, FiDollarSign, FiRefreshCw, FiClipboard } from 'react-icons/fi';
import ChecklistEditor from '../../../pages/admin/ChecklistEditor';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import StripeCardForm from './StripeCardForm';
import CardManagementModal from './CardManagementModal';
import PurchaseCreditsModal from './PurchaseCreditsModal';
import AutoReloadSettings from './AutoReloadSettings';
import CheckInSettings from './CheckInSettings';
import SMSTemplates from './SMSTemplates';
import AOBExportModal from './AOBExportModal';
import './PipelineSettings.css';

// Initialize Stripe with publishable key
const stripePublishableKey = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || 'pk_live_51RWdlFCWGp502EtX31JKFMyHlTGUdoKzPdSXyVW5Z5iELKPnadNDMIygB3EodwXsOIwmEIOmmiJXaEOWk7eyx8hx002MQKBpBn';

// Initialize Stripe with error handling
let stripePromise = null;
try {
  if (stripePublishableKey) {
    stripePromise = loadStripe(stripePublishableKey).catch(error => {
      console.error('[PipelineSettings] Failed to load Stripe.js:', error);
      return null;
    });
  }
} catch (error) {
  console.error('[PipelineSettings] Error initializing Stripe:', error);
  stripePromise = Promise.resolve(null);
}

const PipelineSettings = () => {
  const { user } = useAuth(); // user kept in case we extend billing with team-level options later
  const [activeTab, setActiveTab] = useState('billing'); // 'billing', 'checkins', 'templates', 'sync'
  const [isSyncing, setIsSyncing] = useState(false);
  const [showAOBExportModal, setShowAOBExportModal] = useState(false);
  const [smsCredits, setSmsCredits] = useState(0);
  const [smsCreditsSummary, setSmsCreditsSummary] = useState({ totalPurchased: 0, totalDebited: 0 });
  const [smsCreditsLoading, setSmsCreditsLoading] = useState(true);
  const [smsCreditsError, setSmsCreditsError] = useState('');
  const [billingInfoMessage, setBillingInfoMessage] = useState('');
  const [billingLoading, setBillingLoading] = useState(false);
  const [showCardForm, setShowCardForm] = useState(false);
  const [showManageCard, setShowManageCard] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [stripeLoaded, setStripeLoaded] = useState(false);
  
  // Test SMS state
  const [testPhoneNumber, setTestPhoneNumber] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testSmsMessage, setTestSmsMessage] = useState('');
  const [clientSecret, setClientSecret] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [hasCard, setHasCard] = useState(false);

  useEffect(() => {
    console.log('[PipelineSettings] useEffect: fetching data');
    fetchSmsCredits();
    fetchPaymentMethods();
    
    // Check if Stripe loaded successfully
    if (stripePromise) {
      stripePromise.then(stripe => {
        if (stripe) {
          setStripeLoaded(true);
        } else {
          console.warn('[PipelineSettings] Stripe.js failed to load');
        }
      }).catch(error => {
        console.error('[PipelineSettings] Error checking Stripe status:', error);
      });
    }
  }, []);

  // Handle onboarding sync
  const handleSyncOnboarding = async () => {
    if (isSyncing) return;
    
    setIsSyncing(true);
    const loadingToast = toast.loading('Syncing pending agents...');
    
    try {
      const response = await api.get('/pending-agent-sync/sync-all');
      
      if (response.data.success) {
        const { created, linked, skipped, errors } = response.data;
        
        toast.success(
          `Sync complete! ${created} created, ${linked} linked, ${skipped} skipped${errors > 0 ? `, ${errors} errors` : ''}`,
          { 
            id: loadingToast,
            duration: 5000 
          }
        );
      } else {
        toast.error('Sync failed: ' + response.data.message, { id: loadingToast });
      }
    } catch (error) {
      console.error('Error syncing onboarding:', error);
      toast.error('Error syncing pending agents. Please try again.', { id: loadingToast });
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle AOB export
  const handleExportAOB = () => {
    setShowAOBExportModal(true);
  };

  const handleAOBExportComplete = () => {
    toast.success('AOB export completed successfully!', { duration: 5000 });
    // Optionally refresh any data here
  };

  const fetchSmsCredits = async () => {
    try {
      setSmsCreditsLoading(true);
      setSmsCreditsError('');
      console.log('[PipelineSettings] Calling GET /recruitment/sms/credits');
      const response = await api.get('/recruitment/sms/credits');
      console.log('[PipelineSettings] /recruitment/sms/credits response:', response);

      if (response.data?.success) {
        setSmsCredits(response.data.balance ?? 0);
        setSmsCreditsSummary(response.data.summary || { totalPurchased: 0, totalDebited: 0 });
      } else {
        setSmsCreditsError(response.data?.message || 'Unable to load texting credits.');
      }
    } catch (error) {
      console.error('Error fetching pipeline SMS credits:', error);
      setSmsCreditsError('Unable to load texting credits.');
    } finally {
      setSmsCreditsLoading(false);
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      console.log('[PipelineSettings] Calling GET /recruitment/billing/payment-methods');
      const response = await api.get('/recruitment/billing/payment-methods');
      console.log('[PipelineSettings] payment-methods response:', response);

      if (response.data?.success) {
        const methods = response.data.paymentMethods || [];
        setHasCard(response.data.hasCard || false);
        if (methods.length > 0) {
          // Use the first payment method (or you could let user select default)
          setPaymentMethod(methods[0]);
        } else {
          setPaymentMethod(null);
        }
      }
    } catch (error) {
      console.error('[PipelineSettings] Error fetching payment methods:', error);
    }
  };

  const handleCardButtonClick = () => {
    if (hasCard && paymentMethod) {
      // Show management modal
      setShowManageCard(true);
    } else {
      // Show add card form
      handleAddBillingCard();
    }
  };

  const handleAddBillingCard = async () => {
    try {
      setBillingLoading(true);
      setBillingInfoMessage('');
      console.log('[PipelineSettings] Calling POST /recruitment/billing/create-setup-intent');
      const response = await api.post('/recruitment/billing/create-setup-intent');
      console.log('[PipelineSettings] create-setup-intent response:', response);

      if (response.data?.success && response.data.clientSecret) {
        console.log('[PipelineSettings] Got clientSecret, showing card form');
        setClientSecret(response.data.clientSecret);
        setShowCardForm(true);
      } else {
        console.log('[PipelineSettings] No clientSecret in response');
        setBillingInfoMessage(response.data?.message || 'Unable to start billing setup.');
      }
    } catch (error) {
      console.error('[PipelineSettings] Error starting billing setup:', error);
      setBillingInfoMessage('An error occurred while starting billing setup.');
    } finally {
      setBillingLoading(false);
    }
  };

  const handleCardSuccess = (paymentMethodId) => {
    console.log('[PipelineSettings] Card added successfully:', paymentMethodId);
    setShowCardForm(false);
    setClientSecret(null);
    setBillingInfoMessage('Payment card added successfully!');
    // Refresh payment methods
    fetchPaymentMethods();
  };

  const handleCardCancel = () => {
    console.log('[PipelineSettings] Card form cancelled');
    setShowCardForm(false);
    setClientSecret(null);
  };

  const handleManageCardClose = () => {
    setShowManageCard(false);
  };

  const handleRemoveCard = async (paymentMethodId) => {
    try {
      console.log('[PipelineSettings] Removing payment method:', paymentMethodId);
      const response = await api.delete(`/recruitment/billing/payment-method/${paymentMethodId}`);
      console.log('[PipelineSettings] Remove response:', response);

      if (response.data?.success) {
        setBillingInfoMessage('Payment card removed successfully!');
        setShowManageCard(false);
        // Refresh payment methods
        fetchPaymentMethods();
      } else {
        throw new Error(response.data?.message || 'Failed to remove card');
      }
    } catch (error) {
      console.error('[PipelineSettings] Error removing card:', error);
      throw error;
    }
  };

  const handleUpdateCard = () => {
    // Close management modal and open add card form
    setShowManageCard(false);
    handleAddBillingCard();
  };

  const handlePurchaseCredits = () => {
    setShowPurchaseModal(true);
  };

  const handlePurchaseSuccess = (credits) => {
    const dollarAmount = (credits / 100).toFixed(2);
    console.log('[PipelineSettings] Purchase successful: $', dollarAmount);
    setShowPurchaseModal(false);
    setBillingInfoMessage(`Successfully added $${dollarAmount} to your balance!`);
    // Refresh balance
    fetchSmsCredits();
  };

  const handlePurchaseClose = () => {
    setShowPurchaseModal(false);
  };

  const handleTestSMS = async () => {
    if (!testPhoneNumber || !testMessage) {
      setTestSmsMessage('Please enter both phone number and message.');
      return;
    }

    setTestSending(true);
    setTestSmsMessage('');

    try {
      // Check if multiple numbers (MMS/group message)
      const phoneNumbers = testPhoneNumber.split(';').map(num => num.trim()).filter(num => num);
      const isGroupMessage = phoneNumbers.length > 1;

      const response = await api.post('/recruitment/sms/send', {
        toNumber: testPhoneNumber,
        message: testMessage,
        isGroupMessage,
      });

      if (response.data.success) {
        const messageType = isGroupMessage ? 'Messages' : 'Text';
        const recipientCount = isGroupMessage ? ` to ${phoneNumbers.length} recipients` : '';
        setTestSmsMessage(`✓ ${messageType} sent successfully${recipientCount}! Cost: $${response.data.cost}. Remaining balance: $${response.data.remainingBalance}`);
        setTestPhoneNumber('');
        setTestMessage('');
        // Refresh balance
        fetchSmsCredits();
      } else {
        setTestSmsMessage(`✗ Failed to send: ${response.data.message}`);
      }
    } catch (error) {
      console.error('Error sending test SMS:', error);
      if (error.response?.status === 402) {
        setTestSmsMessage('✗ Insufficient balance. Please add more balance to send texts.');
      } else {
        setTestSmsMessage(`✗ Error: ${error.response?.data?.message || error.message}`);
      }
    } finally {
      setTestSending(false);
    }
  };

  // Check if user should see test SMS section
  const canTestSMS = user?.clname === 'SGA' && user?.Role === 'Admin' && smsCredits > 0;

  return (
    <div className="pipeline-settings-container">
      <div className="settings-header">
        <h2>Pipeline Configuration</h2>
        <p>Configure pipeline stages, checklist items, and texting/billing for your team</p>
      </div>

      {/* Tabs */}
      <div className="pipeline-settings-tabs">
        <button
          className={`pipeline-settings-tab ${activeTab === 'billing' ? 'active' : ''}`}
          onClick={() => setActiveTab('billing')}
        >
          <FiDollarSign size={18} />
          <span>Billing & Balance</span>
        </button>
        <button
          className={`pipeline-settings-tab ${activeTab === 'checkins' ? 'active' : ''}`}
          onClick={() => setActiveTab('checkins')}
        >
          <FiMessageCircle size={18} />
          <span>Check-Ins</span>
        </button>
        <button
          className={`pipeline-settings-tab ${activeTab === 'templates' ? 'active' : ''}`}
          onClick={() => setActiveTab('templates')}
        >
          <FiFileText size={18} />
          <span>Templates</span>
        </button>
        <button
          className={`pipeline-settings-tab ${activeTab === 'sync' ? 'active' : ''}`}
          onClick={() => setActiveTab('sync')}
        >
          <FiRefreshCw size={18} />
          <span>Sync Onboarding</span>
        </button>
        <button
          className={`pipeline-settings-tab ${activeTab === 'checklist' ? 'active' : ''}`}
          onClick={() => setActiveTab('checklist')}
        >
          <FiClipboard size={18} />
          <span>Checklist</span>
        </button>
      </div>

      <div className="pipeline-settings-tab-content">
        {/* Billing & Balance Tab */}
        {activeTab === 'billing' && (
          <div className="settings-content">
        {/* Texting Balance & Billing */}
        <div className="pipeline-billing-card">
          <div className="pipeline-billing-header">
            <h3>Texting Balance & Billing</h3>
            <p className="settings-note">
              Manage your SMS balance for recruiting pipeline texts and set up a billing card via Stripe.
            </p>
          </div>

          {smsCreditsError && (
            <div className="pipeline-billing-alert error">
              {smsCreditsError}
            </div>
          )}

          {smsCreditsLoading ? (
            <div className="pipeline-billing-loading-row">
              <div className="pipeline-loading-spinner" />
              <span>Loading balance…</span>
            </div>
          ) : (
            <div className="pipeline-billing-body">
              <div className="pipeline-billing-row">
                <div>
                  <div className="pipeline-billing-label">Current Balance</div>
                  <div className="pipeline-billing-value">
                    ${(smsCredits / 100).toFixed(2)}
                  </div>
                  <div className="pipeline-billing-subtext">
                    {smsCreditsSummary.totalDebited
                      ? `You've used $${(smsCreditsSummary.totalDebited / 100).toFixed(2)} so far.`
                      : 'No texts have been sent yet.'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="pipeline-btn pipeline-btn-primary"
                    onClick={handlePurchaseCredits}
                  >
                    <FiShoppingCart style={{ marginRight: 6 }} />
                    Add Balance
                  </button>
                  <button
                    type="button"
                    className="pipeline-btn"
                    onClick={fetchSmsCredits}
                  >
                    Refresh
                  </button>
                </div>
              </div>

              <div className="pipeline-billing-row">
                <div>
                  <div className="pipeline-billing-label">Billing Card</div>
                  <div className="pipeline-billing-subtext">
                    {hasCard && paymentMethod
                      ? `${paymentMethod.brand.charAt(0).toUpperCase() + paymentMethod.brand.slice(1)} ending in ${paymentMethod.last4}`
                      : 'Connect a payment method to fund SMS credit purchases through Stripe.'}
                  </div>
                </div>
                <button
                  type="button"
                  className="pipeline-btn"
                  onClick={handleCardButtonClick}
                  disabled={billingLoading}
                >
                  <FiCreditCard style={{ marginRight: 6 }} />
                  {billingLoading ? 'Starting…' : (hasCard ? 'Manage Card' : 'Add Card')}
                </button>
              </div>

               {billingInfoMessage && (
                 <div className="pipeline-billing-alert info">
                   {billingInfoMessage}
                 </div>
               )}
            </div>
          )}
        </div>

            {/* Auto-Reload Settings */}
            <div className="pipeline-billing-card">
              <AutoReloadSettings />
            </div>
          </div>
        )}

        {/* Check-Ins Tab */}
        {activeTab === 'checkins' && (
          <div className="settings-content">
            <CheckInSettings />
          </div>
        )}

        {/* Templates Tab */}
        {activeTab === 'templates' && (
          <div className="settings-content">
            <div className="pipeline-billing-card">
              <SMSTemplates />
            </div>

            {/* Test SMS Section - Only for SGA Admin with balance */}
            {canTestSMS && (
              <div className="pipeline-billing-card">
                <div className="pipeline-billing-header">
                  <h3>Test SMS</h3>
                  <p className="settings-note">
                    Send a test text message to verify your TextMagic integration. Use semicolons to send to multiple recipients.
                  </p>
                </div>

                <div className="pipeline-billing-body">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="form-field">
                      <label>Phone Number(s)</label>
                      <input
                        type="text"
                        className="pipeline-input"
                        placeholder="+1234567890 or +1234567890;+0987654321 for multiple"
                        value={testPhoneNumber}
                        onChange={(e) => setTestPhoneNumber(e.target.value)}
                        disabled={testSending}
                      />
                      {testPhoneNumber.includes(';') && (
                        <div style={{ fontSize: '12px', color: '#3b82f6', marginTop: 4 }}>
                          Will send to {testPhoneNumber.split(';').filter(n => n.trim()).length} recipients individually
                        </div>
                      )}
                    </div>

                    <div className="form-field">
                      <label>Message</label>
                      <textarea
                        className="pipeline-input"
                        placeholder="Enter your test message..."
                        rows={3}
                        value={testMessage}
                        onChange={(e) => setTestMessage(e.target.value)}
                        disabled={testSending}
                        maxLength={5000}
                      />
                      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: 4 }}>
                        {testMessage.length}/5000 characters
                        {testMessage.length > 160 && <span style={{ color: '#f59e0b', marginLeft: '8px' }}>(multiple segments)</span>}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="pipeline-btn pipeline-btn-primary"
                      onClick={handleTestSMS}
                      disabled={testSending || !testPhoneNumber || !testMessage}
                      style={{ alignSelf: 'flex-start' }}
                    >
                      {testSending ? 'Sending...' : 'Send Test SMS'}
                    </button>

                    {testSmsMessage && (
                      <div className={`pipeline-billing-alert ${testSmsMessage.startsWith('✓') ? 'success' : 'error'}`}>
                        {testSmsMessage}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sync Onboarding Tab */}
        {activeTab === 'sync' && (
          <div className="settings-content">
            <div className="pipeline-billing-card">
              <h3 style={{ marginTop: 0 }}>Sync Onboarding Portal</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
                Sync pending agents from the onboarding portal and automatically create pipeline records with completed checklists for prior stages.
              </p>
              
              <button
                className="pipeline-btn pipeline-btn-primary"
                onClick={handleSyncOnboarding}
                disabled={isSyncing}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 24px',
                  fontSize: '16px'
                }}
              >
                {isSyncing ? (
                  <>
                    <span className="sync-spinner" style={{
                      display: 'inline-block',
                      animation: 'spin 1s linear infinite'
                    }}>⟳</span>
                    <span>Syncing...</span>
                  </>
                ) : (
                  <>
                    <FiRefreshCw size={18} />
                    <span>Sync Onboarding</span>
                  </>
                )}
              </button>

              <style>{`
                @keyframes spin {
                  from { transform: rotate(0deg); }
                  to { transform: rotate(360deg); }
                }
              `}</style>

              <div style={{ marginTop: '24px', padding: '16px', background: 'var(--info-bg, #e3f2fd)', borderRadius: '8px', border: '1px solid var(--info-border, #90caf9)' }}>
                <h4 style={{ margin: '0 0 8px 0', color: 'var(--info-text, #1976d2)' }}>What This Does:</h4>
                <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary)' }}>
                  <li>Fetches all pending agents from the onboarding portal</li>
                  <li>Creates pipeline records for new agents</li>
                  <li>Links existing agents if they're already in the system</li>
                  <li>Auto-completes checklist items for stages they've passed</li>
                  <li>Skips agents that are already synced</li>
                </ul>
              </div>
            </div>

            {/* AOB Export Section */}
            <div className="pipeline-billing-card" style={{ marginTop: '30px' }}>
              <h3 style={{ marginTop: 0 }}>Export AOB Updates</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
                Export Application Processing Status data from AIL Portal and track historical changes in workflow status, steps, and progress for all agents. Each export creates a new snapshot to monitor changes over time.
              </p>
              
              <button
                className="pipeline-btn pipeline-btn-success"
                onClick={handleExportAOB}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 24px',
                  fontSize: '16px',
                  background: '#10b981',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                <FiFileText size={18} />
                <span>Export AOB Updates</span>
              </button>

              <div style={{ marginTop: '24px', padding: '16px', background: 'var(--info-bg, #e3f2fd)', borderRadius: '8px', border: '1px solid var(--info-border, #90caf9)' }}>
                <h4 style={{ margin: '0 0 8px 0', color: 'var(--info-text, #1976d2)' }}>What This Does:</h4>
                <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary)' }}>
                  <li>Logs into AIL Portal with your credentials</li>
                  <li>Navigates to Application Processing Status page</li>
                  <li>Exports all status data (ALL statuses) to Excel</li>
                  <li>Inserts new rows into AOBUpdates table to track changes over time</li>
                  <li>Allows you to monitor workflow status, steps, and progress for each agent</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'checklist' && (
          <ChecklistEditor />
        )}

        {/* AOB Export Modal */}
        <AOBExportModal
          isOpen={showAOBExportModal}
          onClose={() => setShowAOBExportModal(false)}
          onComplete={handleAOBExportComplete}
        />
      </div>

      {/* Stripe Card Form Modal */}
      {showCardForm && clientSecret && stripeLoaded && stripePromise && (
        <Elements stripe={stripePromise}>
          <StripeCardForm
            clientSecret={clientSecret}
            onSuccess={handleCardSuccess}
            onCancel={handleCardCancel}
          />
        </Elements>
      )}
      
      {/* Stripe Loading Error Message */}
      {showCardForm && !stripeLoaded && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          zIndex: 1000,
          textAlign: 'center'
        }}>
          <p>Payment processing is temporarily unavailable.</p>
          <button onClick={handleCardCancel} style={{ marginTop: '10px' }}>Close</button>
        </div>
      )}

      {/* Card Management Modal */}
      {showManageCard && paymentMethod && (
        <CardManagementModal
          paymentMethod={paymentMethod}
          onClose={handleManageCardClose}
          onRemove={handleRemoveCard}
          onUpdate={handleUpdateCard}
        />
      )}

      {/* Purchase Credits Modal */}
      {showPurchaseModal && (
        <PurchaseCreditsModal
          onClose={handlePurchaseClose}
          onSuccess={handlePurchaseSuccess}
          hasPaymentMethod={hasCard}
        />
      )}
    </div>
  );
};

export default PipelineSettings;

