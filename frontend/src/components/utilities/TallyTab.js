import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FiPhone, FiActivity, FiHash, FiShield, FiLink, FiTrash2, FiSearch, FiPlus, FiCheck, FiStar, FiClock, FiChevronDown, FiChevronUp, FiCreditCard, FiDollarSign, FiLock, FiDownload, FiGift, FiCopy, FiUsers, FiRefreshCw } from 'react-icons/fi';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardNumberElement, CardExpiryElement, CardCvcElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import axios from 'axios';
import './TallyTab.css';

const TALLY_API_URL = process.env.REACT_APP_TALLY_API_URL || 'https://intense-dusk-79330-68ded9c767c7.herokuapp.com';
const TALLY_API_KEY = process.env.REACT_APP_TALLY_API_KEY || 'atlas-tally-integration-2026';

const STRIPE_PROMISE = loadStripe('pk_live_51T8LHCGXEN0cLwpTxJ0FEtPoq9wOdVTUhvQJmG7Ui2xyOBMosCWEG8DA5BycYLlj5UIuR0cYuhzQV8sRjdUOZjjA00o90Ipcav');

const PLAN_INFO = {
  basic: { label: 'Basic', dials: 150, price: 225, priceStr: '$225/mo', priceId: 'price_1T93FWGXEN0cLwpT1bm37YPV' },
  pro: { label: 'Pro', dials: 275, price: 350, priceStr: '$350/mo', priceId: 'price_1T93FWGXEN0cLwpT4n9gTxuq' },
  'pro-plus': { label: 'Ultra', dials: 450, price: 475, priceStr: '$475/mo', priceId: 'price_1T93FXGXEN0cLwpTO5eEExqy' },
};

// Stripe card element styles
const CARD_ELEMENT_STYLE = {
  base: {
    fontSize: '15px',
    color: 'var(--text-primary, #1f2937)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    '::placeholder': { color: 'var(--text-secondary, #9ca3af)' },
  },
  invalid: { color: '#ef4444' },
};

// ============================================================
// CardForm — Stripe Elements card input (rendered inside Elements provider)
// ============================================================
const CardForm = ({ onSuccess, onError, submitting, setSubmitting }) => {
  const stripe = useStripe();
  const elements = useElements();
  const expiryRef = useRef(null);
  const cvcRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    try {
      const cardNumber = elements.getElement(CardNumberElement);
      const { error, paymentMethod } = await stripe.createPaymentMethod({ type: 'card', card: cardNumber });
      if (error) {
        onError(error.message);
        setSubmitting(false);
        return;
      }
      onSuccess(paymentMethod.id);
    } catch (err) {
      onError(err.message || 'Error processing card.');
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="tally-card-form">
      <div className="tally-card-field">
        <label>Card Number</label>
        <div className="tally-stripe-element">
          <CardNumberElement
            options={{ style: CARD_ELEMENT_STYLE, showIcon: true }}
            onChange={(e) => { if (e.complete && expiryRef.current) expiryRef.current.focus(); }}
          />
        </div>
      </div>
      <div className="tally-form-row">
        <div className="tally-card-field">
          <label>Expiration</label>
          <div className="tally-stripe-element">
            <CardExpiryElement
              options={{ style: CARD_ELEMENT_STYLE }}
              onReady={(el) => { expiryRef.current = el; }}
              onChange={(e) => { if (e.complete && cvcRef.current) cvcRef.current.focus(); }}
            />
          </div>
        </div>
        <div className="tally-card-field">
          <label>CVC</label>
          <div className="tally-stripe-element">
            <CardCvcElement
              options={{ style: CARD_ELEMENT_STYLE }}
              onReady={(el) => { cvcRef.current = el; }}
            />
          </div>
        </div>
      </div>
      <button type="submit" className="tally-btn tally-btn-primary" disabled={!stripe || submitting}>
        <FiCreditCard /> {submitting ? 'Adding...' : 'Add Payment Method'}
      </button>
    </form>
  );
};

// ============================================================
// Main TallyTab Component
// ============================================================
const TallyTab = () => {
  const { user } = useAuth();
  const isTallyAdmin = user?.userId === 92 || Number(user?.id) === 92;
  const [activeTab, setActiveTab] = useState('overview');
  const [linkStatus, setLinkStatus] = useState({ isLinked: false, loading: true });

  // Admin
  const [adminData, setAdminData] = useState(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState(new Set());

  // Registration
  const [regForm, setRegForm] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [regSubmitting, setRegSubmitting] = useState(false);
  const [regMsg, setRegMsg] = useState({ type: '', text: '' });

  // Link existing
  const [linkEmail, setLinkEmail] = useState('');
  const [linkPassword, setLinkPassword] = useState('');
  const [linkSubmitting, setLinkSubmitting] = useState(false);
  const [linkMsg, setLinkMsg] = useState({ type: '', text: '' });
  const [showLinkForm, setShowLinkForm] = useState(false);

  // Profile
  const [profile, setProfile] = useState(null);

  // Subscription
  const [subData, setSubData] = useState(null);
  const [subLoading, setSubLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState('pro');
  const [promoCode, setPromoCode] = useState('');
  const [promoResult, setPromoResult] = useState(null);
  const [validatingPromo, setValidatingPromo] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [subMsg, setSubMsg] = useState({ type: '', text: '' });
  const [showAddCard, setShowAddCard] = useState(false);
  const [cardSubmitting, setCardSubmitting] = useState(false);
  const [changingPlan, setChangingPlan] = useState(false);
  const [showPlanChange, setShowPlanChange] = useState(false);
  const [newPlan, setNewPlan] = useState('');

  // Unified data filter
  const [dataFilter, setDataFilter] = useState('month');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Usage
  const [usage, setUsage] = useState(null);

  // Sessions
  const [sessions, setSessions] = useState([]);
  const [sessionSummary, setSessionSummary] = useState({});
  const [expandedSession, setExpandedSession] = useState(null);
  const [sessionCalls, setSessionCalls] = useState({});

  // Phone numbers
  const [phoneNumbers, setPhoneNumbers] = useState([]);
  const [areaCodeSearch, setAreaCodeSearch] = useState('');
  const [availableNumbers, setAvailableNumbers] = useState([]);
  const [searchingNumbers, setSearchingNumbers] = useState(false);
  const [selectedNumbers, setSelectedNumbers] = useState([]);
  const [buyingNumbers, setBuyingNumbers] = useState(false);

  // Caller IDs
  const [callerIds, setCallerIds] = useState([]);
  const [defaultCallerId, setDefaultCallerId] = useState(null);
  const [verifyPhone, setVerifyPhone] = useState('');
  const [verifyName, setVerifyName] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState({ type: '', text: '' });
  const [validationCode, setValidationCode] = useState(null);

  // Referrals
  const [referralCode, setReferralCode] = useState('');
  const [referralStats, setReferralStats] = useState(null);
  const [referralLoading, setReferralLoading] = useState(false);
  const [referralCodeInput, setReferralCodeInput] = useState('');
  const [referralValidation, setReferralValidation] = useState(null);
  const [validatingReferral, setValidatingReferral] = useState(false);
  const [referralMsg, setReferralMsg] = useState({ type: '', text: '' });
  const [codeCopied, setCodeCopied] = useState(false);

  // General message
  const [msg, setMsg] = useState({ type: '', text: '' });

  // Derived: has active subscription?
  const hasActiveSub = subData?.hasSubscription === true;

  const fetchLinkStatus = useCallback(async () => {
    try {
      const r = await api.get('/account/tally/status');
      if (r.data.success) {
        setLinkStatus({ isLinked: r.data.isLinked, email: r.data.email, subscription: r.data.subscription, loading: false });
      } else {
        setLinkStatus(prev => ({ ...prev, loading: false }));
      }
    } catch {
      setLinkStatus(prev => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => { fetchLinkStatus(); }, [fetchLinkStatus]);

  useEffect(() => {
    if (linkStatus.isLinked) {
      fetchProfile();
      fetchSubscription();
      fetchUsage();
      fetchSessions();
      fetchPhoneNumbers();
      fetchCallerIds();
    }
  }, [linkStatus.isLinked]);

  // ---- Data Fetchers ----
  const fetchProfile = async () => {
    try {
      const r = await api.get('/tally/profile');
      if (r.data.success) setProfile(r.data.user);
    } catch { /* ignore */ }
  };

  const fetchSubscription = async () => {
    setSubLoading(true);
    try {
      const r = await api.get('/tally/subscription');
      if (r.data.success) {
        setSubData(r.data);
        // If no subscription, default to subscription tab
        if (!r.data.hasSubscription) setActiveTab('subscription');
      }
    } catch { /* ignore */ }
    setSubLoading(false);
  };


  const fetchUsage = async () => {
    try {
      const month = dataFilter === 'month' ? selectedMonth : new Date().getMonth() + 1;
      const year = dataFilter === 'month' ? selectedYear : new Date().getFullYear();
      const r = await api.get(`/tally/usage/monthly?year=${year}&month=${month}`);
      if (r.data.success) setUsage(r.data);
    } catch { /* ignore */ }
  };

  const fetchSessions = async () => {
    try {
      let url = `/tally/sessions?filter=${dataFilter}&limit=50`;
      if (dataFilter === 'month') {
        url += `&year=${selectedYear}&month=${selectedMonth}`;
      }
      const r = await api.get(url);
      if (r.data.success) {
        setSessions(r.data.data);
        setSessionSummary(r.data.summary);
      }
    } catch { /* ignore */ }
  };

  const fetchPhoneNumbers = async () => {
    try {
      const r = await api.get('/tally/phone-numbers');
      if (r.data.success) setPhoneNumbers(r.data.data);
    } catch { /* ignore */ }
  };

  const fetchCallerIds = async () => {
    try {
      const r = await api.get('/tally/caller-ids');
      if (r.data.success) {
        setCallerIds(r.data.data);
        setDefaultCallerId(r.data.defaultCallerId);
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (linkStatus.isLinked) {
      fetchUsage();
      fetchSessions();
      setExpandedSession(null);
    }
  }, [dataFilter, selectedMonth, selectedYear]);

  // ---- Registration ----
  const handleRegister = async () => {
    const { firstName, lastName, email, phone, password, confirmPassword } = regForm;
    if (!firstName || !lastName || !email || !password) {
      setRegMsg({ type: 'error', text: 'Please fill in all required fields.' });
      return;
    }
    if (password.length < 6) {
      setRegMsg({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }
    if (password !== confirmPassword) {
      setRegMsg({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    setRegMsg({ type: '', text: '' });
    setRegSubmitting(true);
    try {
      const r = await api.post('/tally/register', { firstName, lastName, email, phone, password });
      if (r.data.success) {
        setRegMsg({ type: 'success', text: 'Account created and linked!' });
        setRegForm({ firstName: '', lastName: '', email: '', phone: '', password: '', confirmPassword: '' });
        await fetchLinkStatus();
      } else {
        setRegMsg({ type: 'error', text: r.data.message || 'Registration failed.' });
      }
    } catch (err) {
      setRegMsg({ type: 'error', text: err.response?.data?.message || 'Error creating account.' });
    } finally { setRegSubmitting(false); }
  };

  // ---- Link Existing ----
  const handleLink = async () => {
    if (!linkEmail.trim() || !linkPassword) {
      setLinkMsg({ type: 'error', text: 'Email and password are required.' });
      return;
    }
    setLinkMsg({ type: '', text: '' });
    setLinkSubmitting(true);
    try {
      const r = await api.post('/account/tally/link', { email: linkEmail.trim(), password: linkPassword });
      if (r.data.success) {
        setLinkMsg({ type: 'success', text: 'Account linked!' });
        setLinkEmail(''); setLinkPassword(''); setShowLinkForm(false);
        await fetchLinkStatus();
      } else {
        setLinkMsg({ type: 'error', text: r.data.message || 'Failed.' });
      }
    } catch (err) {
      setLinkMsg({ type: 'error', text: err.response?.data?.message || 'Error linking.' });
    } finally { setLinkSubmitting(false); }
  };

  // ---- Unlink ----
  const handleUnlink = async () => {
    if (!window.confirm('Unlink your Tally account? You can re-link it later.')) return;
    try {
      await api.delete('/account/tally/unlink');
      setLinkStatus({ isLinked: false, loading: false });
      setProfile(null); setUsage(null); setSessions([]);
      setPhoneNumbers([]); setCallerIds([]); setSubData(null);
    } catch { /* ignore */ }
  };

  // ---- Subscription / Billing ----
  const ensureCustomer = async () => {
    if (subData?.stripeCustomerId) return subData.stripeCustomerId;
    const r = await api.post('/tally/subscription/ensure-customer');
    if (r.data.success) {
      setSubData(prev => ({ ...prev, stripeCustomerId: r.data.customerId }));
      return r.data.customerId;
    }
    throw new Error('Could not set up billing profile.');
  };

  const handleAddCard = async (paymentMethodId) => {
    try {
      const customerId = await ensureCustomer();
      const r = await api.post('/tally/subscription/add-payment-method', { paymentMethodId, customerId });
      if (r.data.success) {
        setSubMsg({ type: 'success', text: 'Payment method added.' });
        setShowAddCard(false);
        await fetchSubscription();
      } else {
        setSubMsg({ type: 'error', text: r.data.message || 'Failed to add card.' });
      }
    } catch (err) {
      setSubMsg({ type: 'error', text: err.response?.data?.message || err.message || 'Error adding card.' });
    }
    setCardSubmitting(false);
  };

  const handleRemoveCard = async (pmId) => {
    if (!window.confirm('Remove this payment method?')) return;
    try {
      const r = await api.post('/tally/subscription/remove-payment-method', {
        paymentMethodId: pmId,
        customerId: subData?.stripeCustomerId,
      });
      if (r.data.success) {
        await fetchSubscription();
      } else {
        setSubMsg({ type: 'error', text: r.data.message || 'Failed.' });
      }
    } catch (err) {
      setSubMsg({ type: 'error', text: err.response?.data?.message || 'Error removing card.' });
    }
  };

  const handleValidatePromo = async () => {
    if (!promoCode.trim()) return;
    setValidatingPromo(true); setPromoResult(null);
    try {
      // Call vonage/Tally backend directly for promo validation (uses new Stripe account)
      const r = await axios.post(`${TALLY_API_URL}/api/stripe/validate-promo-atlas`,
        { promoCode: promoCode.trim() },
        { headers: { 'x-api-key': TALLY_API_KEY, 'Content-Type': 'application/json' } }
      );
      if (r.data.success) {
        setPromoResult(r.data);
      }
    } catch {
      setPromoResult({ valid: false, message: 'Error validating code.' });
    }
    setValidatingPromo(false);
  };

  const handleSubscribe = async () => {
    if (!subData?.paymentMethods?.length) {
      setSubMsg({ type: 'error', text: 'Please add a payment method first.' });
      return;
    }
    setSubscribing(true); setSubMsg({ type: '', text: '' });
    try {
      const body = { plan: selectedPlan };
      if (referralValidation?.valid && referralCodeInput.trim()) {
        body.referralCode = referralCodeInput.trim();
      } else if (promoResult?.valid && promoResult.promoCodeId) {
        body.promoCode = promoResult.promoCodeId;
      }
      const r = await api.post('/tally/subscription/create', body);
      if (r.data.success) {
        setSubMsg({ type: 'success', text: r.data.message || 'Subscribed!' });
        setPromoCode(''); setPromoResult(null);
        await fetchSubscription();
        await fetchProfile();
      } else {
        setSubMsg({ type: 'error', text: r.data.message || 'Subscription failed.' });
      }
    } catch (err) {
      setSubMsg({ type: 'error', text: err.response?.data?.message || 'Error creating subscription.' });
    }
    setSubscribing(false);
  };

  const handleChangePlan = async () => {
    if (!newPlan || newPlan === subData?.plan) return;
    setChangingPlan(true); setSubMsg({ type: '', text: '' });
    try {
      const r = await api.post('/tally/subscription/update', { plan: newPlan });
      if (r.data.success) {
        setSubMsg({ type: 'success', text: r.data.message });
        setShowPlanChange(false);
        await fetchSubscription();
        await fetchProfile();
      } else {
        setSubMsg({ type: 'error', text: r.data.message || 'Failed.' });
      }
    } catch (err) {
      setSubMsg({ type: 'error', text: err.response?.data?.message || 'Error changing plan.' });
    }
    setChangingPlan(false);
  };

  // ---- Phone Numbers ----
  const searchAvailable = async () => {
    if (areaCodeSearch.length !== 3) {
      setMsg({ type: 'error', text: 'Enter a 3-digit area code.' });
      return;
    }
    setSearchingNumbers(true); setAvailableNumbers([]); setSelectedNumbers([]);
    try {
      const r = await api.get(`/tally/phone-numbers/available?areaCode=${areaCodeSearch}`);
      if (r.data.success) setAvailableNumbers(r.data.data);
      else setMsg({ type: 'error', text: r.data.message || 'No numbers found.' });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Error searching.' });
    } finally { setSearchingNumbers(false); }
  };

  const toggleSelectNumber = (num) => {
    setSelectedNumbers(prev =>
      prev.find(n => n.phoneNumber === num.phoneNumber)
        ? prev.filter(n => n.phoneNumber !== num.phoneNumber)
        : [...prev, num]
    );
  };

  const buyNumbers = async () => {
    if (selectedNumbers.length === 0) return;
    const isFirst = phoneNumbers.length === 0;
    const cost = isFirst ? (selectedNumbers.length - 1) * 5 : selectedNumbers.length * 5;
    const confirmMsg = cost > 0
      ? `Buy ${selectedNumbers.length} number(s) for $${cost.toFixed(2)}?`
      : `Claim your first number for free?`;
    if (!window.confirm(confirmMsg)) return;
    setBuyingNumbers(true);
    try {
      const r = await api.post('/tally/phone-numbers/buy', {
        numbers: selectedNumbers.map(n => ({ phoneNumber: n.phoneNumber, friendlyName: n.friendlyName })),
        isFirstNumber: isFirst,
      });
      if (r.data.success) {
        setMsg({ type: 'success', text: r.data.message });
        setSelectedNumbers([]); setAvailableNumbers([]);
        await fetchPhoneNumbers();
      } else {
        setMsg({ type: 'error', text: r.data.message || 'Purchase failed.' });
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Error purchasing.' });
    } finally { setBuyingNumbers(false); }
  };

  const releaseNumber = async (sid) => {
    if (!window.confirm('Release this phone number? This cannot be undone.')) return;
    try {
      const r = await api.delete(`/tally/phone-numbers/${sid}`);
      if (r.data.success) await fetchPhoneNumbers();
    } catch { /* ignore */ }
  };

  // ---- Caller ID ----
  const initiateVerification = async () => {
    if (!verifyPhone) {
      setVerifyMsg({ type: 'error', text: 'Enter a phone number.' });
      return;
    }
    setVerifying(true); setVerifyMsg({ type: '', text: '' }); setValidationCode(null);
    try {
      const r = await api.post('/tally/caller-ids/verify', { phoneNumber: verifyPhone, friendlyName: verifyName });
      if (r.data.success) {
        setValidationCode(r.data.validationCode);
        setVerifyMsg({ type: 'success', text: `Verification call sent! Enter code: ${r.data.validationCode}` });
        await fetchCallerIds();
      } else {
        setVerifyMsg({ type: 'error', text: r.data.message || 'Verification failed.' });
      }
    } catch (err) {
      setVerifyMsg({ type: 'error', text: err.response?.data?.message || 'Error verifying.' });
    } finally { setVerifying(false); }
  };

  const checkVerificationStatus = async (phoneNumber) => {
    try {
      const r = await api.get(`/tally/caller-ids/status/${encodeURIComponent(phoneNumber)}`);
      if (r.data.success && r.data.verified) {
        setVerifyMsg({ type: 'success', text: 'Number verified!' });
        setValidationCode(null); setVerifyPhone(''); setVerifyName('');
        await fetchCallerIds();
      } else {
        setVerifyMsg({ type: 'info', text: 'Not yet verified. Please answer the call and enter the code.' });
      }
    } catch { /* ignore */ }
  };

  const setDefaultCaller = async (phoneNumber) => {
    try {
      const r = await api.post('/tally/caller-ids/default', { phoneNumber });
      if (r.data.success) {
        setDefaultCallerId(phoneNumber);
        await fetchCallerIds();
      }
    } catch { /* ignore */ }
  };

  const deleteCallerId = async (id) => {
    if (!window.confirm('Remove this caller ID?')) return;
    try {
      const r = await api.delete(`/tally/caller-ids/${id}`);
      if (r.data.success) await fetchCallerIds();
    } catch { /* ignore */ }
  };

  // ---- Session expand ----
  const toggleSession = async (sessionId) => {
    if (expandedSession === sessionId) { setExpandedSession(null); return; }
    setExpandedSession(sessionId);
    if (!sessionCalls[sessionId]) {
      try {
        const r = await api.get(`/tally/sessions/${sessionId}/calls`);
        if (r.data.success) setSessionCalls(prev => ({ ...prev, [sessionId]: r.data.data }));
      } catch { /* ignore */ }
    }
  };

  // ---- Referrals ----
  const fetchReferralCode = async () => {
    try {
      const r = await api.get('/tally/referral/code');
      if (r.data.success) setReferralCode(r.data.code);
    } catch { /* ignore */ }
  };

  const fetchReferralStats = async () => {
    setReferralLoading(true);
    try {
      const r = await api.get('/tally/referral/stats');
      if (r.data.success) {
        setReferralStats(r.data);
        if (r.data.code) setReferralCode(r.data.code);
      }
    } catch { /* ignore */ }
    setReferralLoading(false);
  };

  const handleCopyCode = () => {
    if (!referralCode) return;
    navigator.clipboard.writeText(referralCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleValidateReferral = async () => {
    if (!referralCodeInput.trim()) return;
    setValidatingReferral(true);
    setReferralValidation(null);
    try {
      const r = await api.post('/tally/referral/validate', { code: referralCodeInput.trim() });
      setReferralValidation(r.data);
    } catch (err) {
      setReferralValidation({ success: false, message: err.response?.data?.message || 'Error validating code.' });
    }
    setValidatingReferral(false);
  };

  // ---- Admin ----
  const fetchAdminData = async () => {
    setAdminLoading(true);
    try {
      const r = await api.get('/tally/admin/overview');
      if (r.data.success) setAdminData(r.data);
    } catch { /* ignore */ }
    setAdminLoading(false);
  };

  // ---- Helpers ----
  const formatPhone = (phone) => {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    return phone;
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  const renderMsg = (msgObj) => {
    if (!msgObj || !msgObj.text) return null;
    return <div className={`tally-msg tally-msg-${msgObj.type}`}>{msgObj.text}</div>;
  };

  // ============================================================
  // NOT LINKED — show registration + link form
  // ============================================================
  if (linkStatus.loading) {
    return <div className="tally-tab"><div className="tally-loading">Loading...</div></div>;
  }

  if (!linkStatus.isLinked) {
    return (
      <div className="tally-tab">
        <div className="tally-header">
          <img src="/tallylogo.png" alt="Tally" className="tally-header-icon" />
          <div>
            <h2>Tally Dialer</h2>
            <p>Browser-based calling and call tracking for your sales team.</p>
          </div>
        </div>

        <div className="tally-onboard-grid">
          <div className="tally-onboard-card">
            <h3><FiPlus /> Create New Account</h3>
            <p>Sign up for Tally and get started with browser-based dialing.</p>
            {renderMsg(regMsg)}
            <div className="tally-form">
              <div className="tally-form-row">
                <div className="tally-form-group">
                  <label>First Name *</label>
                  <input value={regForm.firstName} onChange={e => setRegForm(p => ({ ...p, firstName: e.target.value }))} placeholder="John" className="tally-input" />
                </div>
                <div className="tally-form-group">
                  <label>Last Name *</label>
                  <input value={regForm.lastName} onChange={e => setRegForm(p => ({ ...p, lastName: e.target.value }))} placeholder="Doe" className="tally-input" />
                </div>
              </div>
              <div className="tally-form-group">
                <label>Email *</label>
                <input type="email" value={regForm.email} onChange={e => setRegForm(p => ({ ...p, email: e.target.value }))} placeholder="john@example.com" className="tally-input" />
              </div>
              <div className="tally-form-group">
                <label>Phone</label>
                <input value={regForm.phone} onChange={e => setRegForm(p => ({ ...p, phone: e.target.value }))} placeholder="555-123-4567" className="tally-input" />
              </div>
              <div className="tally-form-row">
                <div className="tally-form-group">
                  <label>Password *</label>
                  <input type="password" value={regForm.password} onChange={e => setRegForm(p => ({ ...p, password: e.target.value }))} placeholder="Min 6 characters" className="tally-input" />
                </div>
                <div className="tally-form-group">
                  <label>Confirm Password *</label>
                  <input type="password" value={regForm.confirmPassword} onChange={e => setRegForm(p => ({ ...p, confirmPassword: e.target.value }))} placeholder="Confirm" className="tally-input"
                    onKeyDown={e => { if (e.key === 'Enter') handleRegister(); }} />
                </div>
              </div>
              <button className="tally-btn tally-btn-primary" onClick={handleRegister} disabled={regSubmitting}>
                {regSubmitting ? 'Creating Account...' : 'Create Account & Link'}
              </button>
            </div>

            <div className="tally-plan-cards">
              {Object.entries(PLAN_INFO).map(([key, info]) => (
                <div key={key} className="tally-plan-card">
                  <div className="tally-plan-name">{info.label}</div>
                  <div className="tally-plan-price">{info.priceStr}</div>
                  <div className="tally-plan-dials">{info.dials} dials/day &middot; ~{Math.round(info.dials * 30)} /mo</div>
                </div>
              ))}
            </div>
            <p className="tally-hint">Subscription can be selected after account creation.</p>
          </div>

          <div className="tally-onboard-card tally-onboard-card-alt">
            <h3><FiLink /> Link Existing Account</h3>
            <p>Already have a Tally account? Connect it here.</p>
            {renderMsg(linkMsg)}
            {!showLinkForm ? (
              <button className="tally-btn tally-btn-secondary" onClick={() => setShowLinkForm(true)}>
                <FiLink /> I have an account
              </button>
            ) : (
              <div className="tally-form">
                <div className="tally-form-group">
                  <label>Tally Email</label>
                  <input type="email" value={linkEmail} onChange={e => setLinkEmail(e.target.value)} placeholder="your@email.com" className="tally-input" />
                </div>
                <div className="tally-form-group">
                  <label>Tally Password</label>
                  <input type="password" value={linkPassword} onChange={e => setLinkPassword(e.target.value)} placeholder="Password" className="tally-input"
                    onKeyDown={e => { if (e.key === 'Enter') handleLink(); }} />
                </div>
                <div className="tally-form-actions">
                  <button className="tally-btn tally-btn-primary" onClick={handleLink} disabled={linkSubmitting}>
                    {linkSubmitting ? 'Linking...' : 'Link Account'}
                  </button>
                  <button className="tally-btn tally-btn-ghost" onClick={() => { setShowLinkForm(false); setLinkEmail(''); setLinkPassword(''); setLinkMsg({ type: '', text: '' }); }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // LINKED — show full Tally dashboard
  // ============================================================
  const plan = profile?.subscriptionPlan;
  const planInfo = plan ? PLAN_INFO[plan] : null;
  const usagePercent = usage?.capacity?.toDateCapacity > 0
    ? Math.round((usage.usage.totalDials / usage.capacity.toDateCapacity) * 100)
    : 0;

  // Tab definitions
  const tabs = [
    { id: 'overview', label: 'Overview', icon: <FiActivity />, requiresSub: true },
    { id: 'numbers', label: 'Phone Numbers', icon: <FiHash />, requiresSub: true },
    { id: 'callerid', label: 'Caller ID', icon: <FiShield />, requiresSub: true },
    { id: 'subscription', label: 'Subscription', icon: <FiDollarSign /> },
    { id: 'extension', label: 'Extension', icon: <FiDownload />, requiresSub: true },
    { id: 'referrals', label: 'Referrals', icon: <FiGift /> },
    ...(isTallyAdmin ? [{ id: 'admin', label: 'Admin', icon: <FiShield /> }] : []),
  ];

  const handleTabClick = (tab) => {
    if (tab.requiresSub && !hasActiveSub) return;
    setActiveTab(tab.id);
    setMsg({ type: '', text: '' });
    setSubMsg({ type: '', text: '' });
    if (tab.id === 'referrals' && !referralStats) {
      fetchReferralCode();
      fetchReferralStats();
    }
    if (tab.id === 'admin' && !adminData) {
      fetchAdminData();
    }
  };

  return (
    <div className="tally-tab">
      <div className="tally-header">
        <img src="/tallylogo.png" alt="Tally" className="tally-header-icon" />
        <div>
          <h2>Tally Dialer</h2>
          <p>{linkStatus.email}{planInfo ? ` \u2014 ${planInfo.label} Plan` : ' \u2014 No active plan'}</p>
        </div>
        <button className="tally-btn tally-btn-ghost tally-btn-sm" onClick={handleUnlink} title="Unlink account">
          <FiTrash2 /> Unlink
        </button>
      </div>

      {renderMsg(msg)}

      <div className="tally-sub-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tally-sub-tab ${activeTab === tab.id ? 'active' : ''} ${tab.requiresSub && !hasActiveSub ? 'disabled' : ''}`}
            onClick={() => handleTabClick(tab)}
            title={tab.requiresSub && !hasActiveSub ? 'Subscribe to a plan first' : ''}
          >
            {tab.requiresSub && !hasActiveSub ? <FiLock style={{ fontSize: '0.7em', marginRight: 2 }} /> : tab.icon}
            {' '}{tab.label}
          </button>
        ))}
      </div>

      {/* ---- SUBSCRIPTION TAB ---- */}
      {activeTab === 'subscription' && (
        <div className="tally-section">
          {renderMsg(subMsg)}

          {subLoading ? (
            <div className="tally-loading">Loading subscription...</div>
          ) : hasActiveSub ? (
            /* ---- Active Subscription View ---- */
            <>
              <div className="tally-billing-card">
                <div className="tally-billing-header">
                  <h3>Current Plan</h3>
                  <span className={`tally-sub-status tally-sub-status-${subData.status}`}>
                    {subData.status}
                  </span>
                </div>

                <div className="tally-billing-plan">
                  <div className="tally-billing-plan-name">
                    {PLAN_INFO[subData.plan]?.label || subData.plan}
                  </div>
                  <div className="tally-billing-plan-details">
                    <span>{PLAN_INFO[subData.plan]?.dials || '?'} dials/day &middot; ~{Math.round((PLAN_INFO[subData.plan]?.dials || 0) * 30)} /mo</span>
                    <span className="tally-billing-price">
                      ${(subData.subscription?.items?.[0]?.unitAmount / 100 || PLAN_INFO[subData.plan]?.price || 0).toFixed(0)}/mo
                    </span>
                  </div>
                </div>

                {subData.subscription?.discount && (
                  <div className="tally-billing-discount">
                    <FiCheck />
                    <span>
                      Discount applied: {subData.subscription.discount.percentOff
                        ? `${subData.subscription.discount.percentOff}% off`
                        : `$${subData.subscription.discount.amountOff} off`}
                      {subData.subscription.discount.promoCode && ` (${subData.subscription.discount.promoCode})`}
                    </span>
                  </div>
                )}

                <div className="tally-billing-dates">
                  {subData.subscription?.currentPeriodEnd && (
                    <div>
                      <span className="tally-billing-date-label">Next billing date</span>
                      <span>{new Date(subData.subscription.currentPeriodEnd * 1000).toLocaleDateString()}</span>
                    </div>
                  )}
                  {subData.subscription?.startDate && (
                    <div>
                      <span className="tally-billing-date-label">Member since</span>
                      <span>{new Date(subData.subscription.startDate * 1000).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                {!showPlanChange ? (
                  <button className="tally-btn tally-btn-secondary tally-btn-sm" onClick={() => { setShowPlanChange(true); const plans = Object.keys(PLAN_INFO); setNewPlan(plans.find(p => p !== subData.plan) || plans[0]); }}>
                    Change Plan
                  </button>
                ) : (
                  <div className="tally-plan-change">
                    <h4>Switch Plan</h4>
                    <div className="tally-plan-select-grid">
                      {Object.entries(PLAN_INFO).map(([key, info]) => (
                        <div
                          key={key}
                          className={`tally-plan-option ${newPlan === key ? 'selected' : ''} ${subData.plan === key ? 'current' : ''}`}
                          onClick={() => setNewPlan(key)}
                        >
                          <div className="tally-plan-check">{newPlan === key && <FiCheck />}</div>
                          <div className="tally-plan-name">{info.label}</div>
                          <div className="tally-plan-price">{info.priceStr}</div>
                          <div className="tally-plan-dials">{info.dials} dials/day &middot; ~{info.dials * 30} /mo</div>
                          {subData.plan === key && <span className="tally-badge-current">Current</span>}
                        </div>
                      ))}
                    </div>
                    <p className="tally-hint">Plan change takes effect at your next billing cycle.</p>
                    <div className="tally-form-actions">
                      <button className="tally-btn tally-btn-primary tally-btn-sm" onClick={handleChangePlan} disabled={changingPlan || newPlan === subData.plan}>
                        {changingPlan ? 'Updating...' : 'Confirm Change'}
                      </button>
                      <button className="tally-btn tally-btn-ghost tally-btn-sm" onClick={() => setShowPlanChange(false)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Payment Methods */}
              <div className="tally-billing-card">
                <h3>Payment Methods</h3>
                {subData.paymentMethods?.length > 0 ? (
                  <div className="tally-pm-list">
                    {subData.paymentMethods.map((pm, i) => (
                      <div key={pm.id} className="tally-pm-item">
                        <div className="tally-pm-info">
                          <FiCreditCard />
                          <span className="tally-pm-brand">{pm.brand}</span>
                          <span className="tally-pm-last4">&bull;&bull;&bull;&bull; {pm.last4}</span>
                          <span className="tally-pm-exp">{pm.expMonth}/{pm.expYear}</span>
                          {i === 0 && <span className="tally-badge-default-sm">Default</span>}
                        </div>
                        {subData.paymentMethods.length > 1 && (
                          <button className="tally-btn tally-btn-ghost tally-btn-sm" onClick={() => handleRemoveCard(pm.id)}>
                            <FiTrash2 />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="tally-empty">No payment methods on file.</div>
                )}

                {!showAddCard ? (
                  <button className="tally-btn tally-btn-secondary tally-btn-sm" onClick={() => setShowAddCard(true)} style={{ marginTop: 10 }}>
                    <FiPlus /> Add Card
                  </button>
                ) : (
                  <div className="tally-add-card-section">
                    <Elements stripe={STRIPE_PROMISE}>
                      <CardForm
                        onSuccess={handleAddCard}
                        onError={(msg) => setSubMsg({ type: 'error', text: msg })}
                        submitting={cardSubmitting}
                        setSubmitting={setCardSubmitting}
                      />
                    </Elements>
                    <button className="tally-btn tally-btn-ghost tally-btn-sm" onClick={() => setShowAddCard(false)} style={{ marginTop: 6 }}>
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* Cancel Info */}
              <div className="tally-billing-card tally-billing-cancel">
                <h4>Need to cancel?</h4>
                <p>Contact <strong>support@callwithtally.com</strong> to request cancellation. Your access continues until the end of your billing period.</p>
              </div>
            </>
          ) : (
            /* ---- No Subscription — Sign Up Flow ---- */
            <>
              <div className="tally-subscribe-intro">
                <h3>Choose Your Plan</h3>
                <p>Select a plan to start using Tally's browser-based power dialer.</p>
              </div>

              <div className="tally-plan-select-grid">
                {Object.entries(PLAN_INFO).map(([key, info]) => (
                  <div
                    key={key}
                    className={`tally-plan-option tally-plan-option-lg ${selectedPlan === key ? 'selected' : ''}`}
                    onClick={() => setSelectedPlan(key)}
                  >
                    <div className="tally-plan-check">{selectedPlan === key && <FiCheck />}</div>
                    {key === 'pro' && <span className="tally-plan-popular">Most Popular</span>}
                    <div className="tally-plan-name">{info.label}</div>
                    <div className="tally-plan-price-lg">${info.price}<span>/mo</span></div>
                    <div className="tally-plan-dials">{info.dials} dials/day &middot; ~{info.dials * 30} /mo</div>
                  </div>
                ))}
              </div>

              {/* Referral Code */}
              <div className="tally-promo-section">
                <label><FiGift style={{ marginRight: 4 }} /> Referral Code</label>
                <div className="tally-promo-row">
                  <input
                    value={referralCodeInput}
                    onChange={e => { setReferralCodeInput(e.target.value.toUpperCase()); setReferralValidation(null); }}
                    placeholder="e.g. TALLY-A3X9K2"
                    className="tally-input tally-input-sm"
                    onKeyDown={e => { if (e.key === 'Enter') handleValidateReferral(); }}
                  />
                  <button className="tally-btn tally-btn-secondary tally-btn-sm" onClick={handleValidateReferral} disabled={validatingReferral || !referralCodeInput.trim()}>
                    {validatingReferral ? 'Checking...' : 'Verify'}
                  </button>
                </div>
                {referralValidation && (
                  <div className={`tally-promo-result ${referralValidation.valid ? 'valid' : 'invalid'}`}>
                    {referralValidation.valid ? (
                      <><FiCheck /> Referred by {referralValidation.referrerName} &mdash; {referralValidation.discount}</>
                    ) : (
                      referralValidation.message || 'Invalid code'
                    )}
                  </div>
                )}
              </div>

              {/* Promo Code */}
              {!referralValidation?.valid && (
                <div className="tally-promo-section">
                  <label>Promo Code</label>
                  <div className="tally-promo-row">
                    <input
                      value={promoCode}
                      onChange={e => { setPromoCode(e.target.value); setPromoResult(null); }}
                      placeholder="Enter code"
                      className="tally-input tally-input-sm"
                      onKeyDown={e => { if (e.key === 'Enter') handleValidatePromo(); }}
                    />
                    <button className="tally-btn tally-btn-secondary tally-btn-sm" onClick={handleValidatePromo} disabled={validatingPromo || !promoCode.trim()}>
                      {validatingPromo ? 'Checking...' : 'Apply'}
                    </button>
                  </div>
                  {promoResult && (
                    <div className={`tally-promo-result ${promoResult.valid ? 'valid' : 'invalid'}`}>
                      {promoResult.valid ? (
                        <><FiCheck /> {promoResult.description}</>
                      ) : (
                        promoResult.message || 'Invalid code'
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Payment Method */}
              <div className="tally-billing-card">
                <h3>Payment Method</h3>
                {subData?.paymentMethods?.length > 0 ? (
                  <>
                    <div className="tally-pm-list">
                      {subData.paymentMethods.map(pm => (
                        <div key={pm.id} className="tally-pm-item">
                          <div className="tally-pm-info">
                            <FiCreditCard />
                            <span className="tally-pm-brand">{pm.brand}</span>
                            <span className="tally-pm-last4">&bull;&bull;&bull;&bull; {pm.last4}</span>
                            <span className="tally-pm-exp">{pm.expMonth}/{pm.expYear}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {(promoResult?.valid || referralValidation?.valid) && (() => {
                      const price = PLAN_INFO[selectedPlan].price;
                      let discount = 0;
                      let discountLabel = '';
                      if (referralValidation?.valid) {
                        discount = 10;
                        discountLabel = 'Referral: $10 off first month';
                      } else if (promoResult?.valid) {
                        discount = promoResult.coupon?.percentOff
                          ? price * promoResult.coupon.percentOff / 100
                          : (promoResult.coupon?.amountOff || 0);
                        discountLabel = promoResult.description;
                      }
                      const finalPrice = Math.max(0, price - discount);
                      return (
                        <div className="tally-promo-summary" style={{ margin: '12px 0', padding: '10px 14px', background: 'rgba(16,185,129,0.08)', borderRadius: 8, border: '1px solid rgba(16,185,129,0.25)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9em', color: 'var(--text-secondary, #6b7280)' }}>
                            <span>Original price</span>
                            <span style={{ textDecoration: 'line-through' }}>${price}/mo</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9em', color: '#10b981', fontWeight: 600 }}>
                            <span>{discountLabel}</span>
                            <span>-${discount.toFixed(2)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1em', marginTop: 4, paddingTop: 6, borderTop: '1px solid rgba(16,185,129,0.2)' }}>
                            <span>You pay{referralValidation?.valid ? ' (first month)' : ''}</span>
                            <span style={{ color: '#10b981' }}>${finalPrice.toFixed(2)}/mo</span>
                          </div>
                        </div>
                      );
                    })()}
                    <button className="tally-btn tally-btn-primary" onClick={handleSubscribe} disabled={subscribing} style={{ marginTop: 12 }}>
                      {subscribing ? 'Subscribing...' : `Subscribe \u2014 ${
                        (() => {
                          const price = PLAN_INFO[selectedPlan].price;
                          if (referralValidation?.valid) return `$${Math.max(0, price - 10).toFixed(2)}/mo`;
                          if (promoResult?.valid) {
                            const disc = promoResult.coupon?.percentOff
                              ? price * promoResult.coupon.percentOff / 100
                              : (promoResult.coupon?.amountOff || 0);
                            return `$${Math.max(0, price - disc).toFixed(2)}/mo`;
                          }
                          return PLAN_INFO[selectedPlan].priceStr;
                        })()
                      }`}
                    </button>
                  </>
                ) : (
                  <div className="tally-add-card-section">
                    <p className="tally-hint" style={{ marginBottom: 10 }}>Add a card to subscribe.</p>
                    <Elements stripe={STRIPE_PROMISE}>
                      <CardForm
                        onSuccess={handleAddCard}
                        onError={(msg) => setSubMsg({ type: 'error', text: msg })}
                        submitting={cardSubmitting}
                        setSubmitting={setCardSubmitting}
                      />
                    </Elements>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ---- OVERVIEW TAB ---- */}
      {activeTab === 'overview' && hasActiveSub && (
        <div className="tally-section">
          {/* Unified Filter Bar */}
          <div className="tally-filter-bar">
            <div className="tally-filter-group">
              {['all', 'today', 'week', 'month'].map(f => (
                <button
                  key={f}
                  className={`tally-filter-btn ${dataFilter === f ? 'active' : ''}`}
                  onClick={() => setDataFilter(f)}
                >
                  {f === 'all' ? 'All' : f === 'today' ? 'Today' : f === 'week' ? 'This Week' : 'This Month'}
                </button>
              ))}
            </div>
            {dataFilter === 'month' && (
              <div className="tally-month-selectors">
                <select value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))} className="tally-select">
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {new Date(2000, i).toLocaleString('default', { month: 'long' })}
                    </option>
                  ))}
                </select>
                <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} className="tally-select">
                  {Array.from({ length: 3 }, (_, i) => {
                    const y = new Date().getFullYear() - i;
                    return <option key={y} value={y}>{y}</option>;
                  })}
                </select>
              </div>
            )}
          </div>

          {/* Usage Bar — shown only for "This Month" filter */}
          {dataFilter === 'month' && usage && (
            <div className="tally-usage-card">
              <div className="tally-usage-header">
                <h3>Monthly Usage</h3>
              </div>
              <div className="tally-usage-bar-container">
                <div className="tally-usage-bar">
                  <div
                    className={`tally-usage-fill ${usagePercent >= 100 ? 'danger' : usagePercent >= 80 ? 'warning' : ''}`}
                    style={{ width: `${Math.min(usagePercent, 100)}%` }}
                  />
                </div>
                <div className="tally-usage-labels">
                  <span>{usage.usage.totalDials} dials</span>
                  <span>{usage.capacity.toDateCapacity > 0 ? `${usagePercent}% of ${usage.capacity.toDateCapacity}` : 'No plan'}</span>
                </div>
              </div>
              {planInfo && (
                <div className="tally-usage-plan">
                  {planInfo.label} — {planInfo.dials} dials/day &middot; {usage.capacity.fullMonthCapacity} /month
                </div>
              )}
            </div>
          )}

          {/* Summary Stats */}
          <div className="tally-stat-grid">
            <div className="tally-stat-card">
              <div className="tally-stat-value">{sessionSummary.totalSessions || 0}</div>
              <div className="tally-stat-label">Sessions</div>
            </div>
            <div className="tally-stat-card">
              <div className="tally-stat-value">{sessionSummary.totalDials || 0}</div>
              <div className="tally-stat-label">Total Dials</div>
            </div>
            <div className="tally-stat-card">
              <div className="tally-stat-value">{formatDuration(sessionSummary.totalDuration || 0)}</div>
              <div className="tally-stat-label">Total Time</div>
            </div>
            <div className="tally-stat-card">
              <div className="tally-stat-value">{formatDuration(Math.round(sessionSummary.avgDuration || 0))}</div>
              <div className="tally-stat-label">Avg Session</div>
            </div>
          </div>

          {/* Session History */}
          <div className="tally-sessions-header">
            <h3>Session History</h3>
          </div>

          {sessions.length === 0 ? (
            <div className="tally-empty">No sessions found.</div>
          ) : (
            <div className="tally-session-list">
              {sessions.map(s => (
                <div key={s.id} className="tally-session-item">
                  <div className="tally-session-row" onClick={() => toggleSession(s.id)}>
                    <div className="tally-session-date">
                      <FiClock />
                      {formatDate(s.created_at)}
                    </div>
                    <div className="tally-session-stats">
                      <span>{s.total_dials} dials</span>
                      <span>{formatDuration(s.session_duration)}</span>
                    </div>
                    {expandedSession === s.id ? <FiChevronUp /> : <FiChevronDown />}
                  </div>
                  {expandedSession === s.id && (
                    <div className="tally-session-calls">
                      {!sessionCalls[s.id] ? (
                        <div className="tally-loading-sm">Loading calls...</div>
                      ) : sessionCalls[s.id].length === 0 ? (
                        <div className="tally-empty-sm">No call logs for this session.</div>
                      ) : (
                        <table className="tally-calls-table">
                          <thead>
                            <tr><th>Time</th><th>To</th><th>Duration</th><th>Status</th></tr>
                          </thead>
                          <tbody>
                            {sessionCalls[s.id].map((c, i) => (
                              <tr key={i}>
                                <td>{c.start_time ? new Date(c.start_time).toLocaleTimeString() : '-'}</td>
                                <td>{formatPhone(c.to_number)}</td>
                                <td>{c.duration_seconds ? formatDuration(c.duration_seconds) : '-'}</td>
                                <td>
                                  <span className={`tally-call-status ${c.status === 'completed' ? 'success' : c.status === 'no-answer' || c.status === 'busy' ? 'warning' : 'danger'}`}>
                                    {c.status || 'unknown'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---- PHONE NUMBERS TAB ---- */}
      {activeTab === 'numbers' && hasActiveSub && (
        <div className="tally-section">
          <h3>Your Phone Numbers</h3>
          {phoneNumbers.length === 0 ? (
            <div className="tally-empty">No phone numbers yet. Search below to get your first number free!</div>
          ) : (
            <div className="tally-number-list">
              {phoneNumbers.map((n, i) => (
                <div key={n.id} className="tally-number-item">
                  <div className="tally-number-info">
                    <span className="tally-number-phone">{formatPhone(n.phone_number)}</span>
                    {n.friendly_name && n.friendly_name !== n.phone_number && (
                      <span className="tally-number-name">{n.friendly_name}</span>
                    )}
                    {i === 0 && <span className="tally-badge-primary">Primary</span>}
                  </div>
                  {phoneNumbers.length > 1 && (
                    <button className="tally-btn tally-btn-ghost tally-btn-sm" onClick={() => releaseNumber(n.sid)}>
                      <FiTrash2 />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="tally-divider" />

          <h3>Get a New Number</h3>
          <div className="tally-search-row">
            <input
              value={areaCodeSearch}
              onChange={e => setAreaCodeSearch(e.target.value.replace(/\D/g, '').slice(0, 3))}
              placeholder="Area code (e.g. 412)"
              className="tally-input tally-input-sm"
              maxLength={3}
              onKeyDown={e => { if (e.key === 'Enter') searchAvailable(); }}
            />
            <button className="tally-btn tally-btn-primary tally-btn-sm" onClick={searchAvailable} disabled={searchingNumbers}>
              <FiSearch /> {searchingNumbers ? 'Searching...' : 'Search'}
            </button>
          </div>

          {availableNumbers.length > 0 && (
            <>
              <div className="tally-available-list">
                {availableNumbers.map(n => {
                  const selected = selectedNumbers.find(s => s.phoneNumber === n.phoneNumber);
                  return (
                    <div
                      key={n.phoneNumber}
                      className={`tally-available-item ${selected ? 'selected' : ''}`}
                      onClick={() => toggleSelectNumber(n)}
                    >
                      <div>
                        <div className="tally-number-phone">{formatPhone(n.phoneNumber)}</div>
                        <div className="tally-number-location">{n.locality}, {n.region}</div>
                      </div>
                      {selected ? <FiCheck className="tally-check-icon" /> : <FiPlus className="tally-plus-icon" />}
                    </div>
                  );
                })}
              </div>
              {selectedNumbers.length > 0 && (
                <div className="tally-cart">
                  <span>{selectedNumbers.length} selected &middot; {phoneNumbers.length === 0 ? 'First number FREE, $5 each after' : `$${(selectedNumbers.length * 5).toFixed(2)}`}</span>
                  <button className="tally-btn tally-btn-primary tally-btn-sm" onClick={buyNumbers} disabled={buyingNumbers}>
                    {buyingNumbers ? 'Purchasing...' : 'Purchase'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ---- CALLER ID TAB ---- */}
      {activeTab === 'callerid' && hasActiveSub && (
        <div className="tally-section">
          <h3>Verified Caller IDs</h3>
          <p className="tally-hint">Verify your personal phone numbers to use as your outgoing caller ID when dialing.</p>

          {phoneNumbers.length === 0 ? (
            <div className="tally-empty" style={{ padding: '24px', textAlign: 'center' }}>
              <FiPhone style={{ fontSize: '2em', marginBottom: 8, opacity: 0.5 }} />
              <p style={{ fontWeight: 500, marginBottom: 4 }}>You must first get a number before setting a caller ID.</p>
              <p style={{ opacity: 0.7, fontSize: '0.9em' }}>Go to the Numbers tab to purchase a phone number.</p>
              <button className="tally-btn tally-btn-primary" style={{ marginTop: 12 }} onClick={() => setActiveTab('numbers')}>
                Get a Number
              </button>
            </div>
          ) : callerIds.length === 0 ? (
            <div className="tally-empty">No caller IDs verified yet.</div>
          ) : (
            <div className="tally-callerid-list">
              {callerIds.map(c => (
                <div key={c.id} className="tally-callerid-item">
                  <div className="tally-callerid-info">
                    <span className="tally-number-phone">{formatPhone(c.phone_number)}</span>
                    {c.friendly_name && c.friendly_name !== c.phone_number && (
                      <span className="tally-number-name">{c.friendly_name}</span>
                    )}
                    {c.is_verified ? (
                      <span className="tally-badge-verified"><FiCheck /> Verified</span>
                    ) : (
                      <span className="tally-badge-pending">Pending</span>
                    )}
                    {c.phone_number === defaultCallerId && (
                      <span className="tally-badge-default"><FiStar /> Default</span>
                    )}
                  </div>
                  <div className="tally-callerid-actions">
                    {c.is_verified && c.phone_number !== defaultCallerId && (
                      <button className="tally-btn tally-btn-ghost tally-btn-sm" onClick={() => setDefaultCaller(c.phone_number)} title="Set as default">
                        <FiStar />
                      </button>
                    )}
                    {!c.is_verified && (
                      <button className="tally-btn tally-btn-ghost tally-btn-sm" onClick={() => checkVerificationStatus(c.phone_number)} title="Check status">
                        <FiCheck />
                      </button>
                    )}
                    <button className="tally-btn tally-btn-ghost tally-btn-sm" onClick={() => deleteCallerId(c.id)} title="Remove">
                      <FiTrash2 />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {phoneNumbers.length > 0 && (
            <>
              <div className="tally-divider" />

              <h3>Verify a New Number</h3>
              {renderMsg(verifyMsg)}
              <div className="tally-form">
                <div className="tally-form-row">
                  <div className="tally-form-group">
                    <label>Phone Number</label>
                    <input value={verifyPhone} onChange={e => setVerifyPhone(e.target.value)} placeholder="555-123-4567" className="tally-input" />
                  </div>
                  <div className="tally-form-group">
                    <label>Label (optional)</label>
                    <input value={verifyName} onChange={e => setVerifyName(e.target.value)} placeholder="My Cell" className="tally-input" />
                  </div>
                </div>
                <button className="tally-btn tally-btn-primary" onClick={initiateVerification} disabled={verifying || !verifyPhone}>
                  <FiPhone /> {verifying ? 'Calling...' : 'Verify Number'}
                </button>
              </div>

              {validationCode && (
                <div className="tally-validation-code">
                  <strong>Validation Code:</strong> <span className="tally-code">{validationCode}</span>
                  <p>Answer the call from Twilio and enter this code when prompted.</p>
                  <button className="tally-btn tally-btn-secondary tally-btn-sm" onClick={() => checkVerificationStatus(verifyPhone)}>
                    <FiCheck /> Check Status
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ---- EXTENSION TAB ---- */}
      {activeTab === 'extension' && hasActiveSub && (
        <div className="tally-section">
          <div className="tally-extension-header">
            <h3>Tally Chrome Extension</h3>
            <span className="tally-badge-pending">Pending Review</span>
          </div>
          <p className="tally-hint">The Tally Chrome Extension integrates directly with your CRM for automated calling, lead progression, and call tracking.</p>

          <div className="tally-extension-features">
            <div className="tally-extension-feature"><FiCheck /> Automated power dialing</div>
            <div className="tally-extension-feature"><FiCheck /> Lead progression tracking</div>
            <div className="tally-extension-feature"><FiCheck /> Call logging & analytics</div>
            <div className="tally-extension-feature"><FiCheck /> CRM integration</div>
          </div>

          <div className="tally-extension-actions">
            <button
              className="tally-btn tally-btn-primary"
              onClick={() => window.open('/downloads/tally-unified.zip', '_blank')}
            >
              <FiDownload /> Download Extension
            </button>
          </div>

          <div className="tally-divider" />

          <h3>Installation Instructions</h3>
          <div className="tally-extension-steps">
            <div className="tally-extension-step">
              <span className="tally-step-number">1</span>
              <div><strong>Download</strong> the extension file using the button above</div>
            </div>
            <div className="tally-extension-step">
              <span className="tally-step-number">2</span>
              <div><strong>Extract</strong> the ZIP file to a folder on your computer</div>
            </div>
            <div className="tally-extension-step">
              <span className="tally-step-number">3</span>
              <div>Open Chrome and navigate to <code>chrome://extensions/</code></div>
            </div>
            <div className="tally-extension-step">
              <span className="tally-step-number">4</span>
              <div>Enable <strong>Developer mode</strong> in the top-right corner</div>
            </div>
            <div className="tally-extension-step">
              <span className="tally-step-number">5</span>
              <div>Click <strong>Load unpacked</strong> and select the extracted folder</div>
            </div>
            <div className="tally-extension-step">
              <span className="tally-step-number">6</span>
              <div>Pin the extension by clicking the <strong>puzzle piece icon</strong> in Chrome's toolbar</div>
            </div>
          </div>

          <div className="tally-divider" />

          <h3>System Requirements</h3>
          <div className="tally-extension-requirements">
            <div>Chrome v88 or later</div>
            <div>Active Tally subscription</div>
            <div>ailife.com CRM access</div>
          </div>
        </div>
      )}

      {/* ---- REFERRALS TAB ---- */}
      {activeTab === 'referrals' && (
        <div className="tally-section">
          {renderMsg(referralMsg)}

          {referralLoading ? (
            <div className="tally-loading">Loading referrals...</div>
          ) : (
            <>
              {/* Your Referral Code */}
              <div className="tally-billing-card">
                <h3><FiGift /> Your Referral Code</h3>
                <p className="tally-hint">Share your code with friends. You get $10/mo off for each person who subscribes, and they get $10 off their first month.</p>

                {referralCode ? (
                  <div className="tally-referral-code-display">
                    <span className="tally-referral-code-value">{referralCode}</span>
                    <button className="tally-btn tally-btn-secondary tally-btn-sm" onClick={handleCopyCode}>
                      {codeCopied ? <><FiCheck /> Copied!</> : <><FiCopy /> Copy</>}
                    </button>
                  </div>
                ) : (
                  <button className="tally-btn tally-btn-primary tally-btn-sm" onClick={fetchReferralCode}>
                    Generate Code
                  </button>
                )}

                {referralStats && (
                  <div className="tally-referral-summary">
                    <div className="tally-referral-stat">
                      <span className="tally-referral-stat-value">{referralStats.activeCount}</span>
                      <span className="tally-referral-stat-label">Active Referrals</span>
                    </div>
                    <div className="tally-referral-stat">
                      <span className="tally-referral-stat-value">${referralStats.totalDiscount}</span>
                      <span className="tally-referral-stat-label">Monthly Savings</span>
                    </div>
                    <div className="tally-referral-stat">
                      <span className="tally-referral-stat-value">{referralStats.referrals?.length || 0}</span>
                      <span className="tally-referral-stat-label">Total Referrals</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Referral List */}
              {referralStats?.referrals?.length > 0 && (
                <div className="tally-billing-card">
                  <h3><FiUsers /> Your Referrals</h3>
                  <div className="tally-referral-list">
                    {referralStats.referrals.map(ref => (
                      <div key={ref.id} className="tally-referral-item">
                        <div className="tally-referral-item-info">
                          <span className="tally-referral-item-name">{ref.name}</span>
                          <span className="tally-referral-item-date">{new Date(ref.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                        <span className={`tally-referral-item-status tally-referral-item-status-${ref.status}`}>
                          {ref.status === 'active' ? '$10/mo saved' : 'Cancelled'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {referralStats?.wasReferred && (
                <div className="tally-msg tally-msg-info">
                  You were referred with code <strong>{referralStats.referredByCode}</strong>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ---- ADMIN TAB ---- */}
      {activeTab === 'admin' && isTallyAdmin && (
        <div className="tally-section">
          {adminLoading ? (
            <div className="tally-loading">Loading admin data...</div>
          ) : adminData ? (
            <>
              {/* Summary Stats */}
              <div className="tally-billing-card">
                <h3>Tally Overview</h3>
                <div className="tally-referral-summary" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                  <div className="tally-referral-stat">
                    <span className="tally-referral-stat-value">{adminData.totalUsers}</span>
                    <span className="tally-referral-stat-label">Total Users</span>
                  </div>
                  <div className="tally-referral-stat">
                    <span className="tally-referral-stat-value">{adminData.activeSubscribers}</span>
                    <span className="tally-referral-stat-label">Active Subscribers</span>
                  </div>
                  <div className="tally-referral-stat">
                    <span className="tally-referral-stat-value">${adminData.monthlyRevenue}</span>
                    <span className="tally-referral-stat-label">Monthly Revenue</span>
                  </div>
                  <div className="tally-referral-stat">
                    <span className="tally-referral-stat-value">${adminData.totalReferralDiscounts}</span>
                    <span className="tally-referral-stat-label">Referral Discounts/mo</span>
                  </div>
                </div>
              </div>

              {/* Twilio Usage Overview */}
              {(() => {
                const subs = adminData.subscribers || [];
                const activeSubs = subs.filter(s => s.status === 'active' || s.status === 'trialing');
                const revenue = activeSubs.reduce((sum, s) => sum + (PLAN_INFO[s.plan]?.price || 0), 0);
                const refDiscounts = (adminData.totalReferralDiscounts || 0);
                const cost = subs.reduce((sum, s) => sum + (s.twilioUsage?.cost || 0), 0);
                const projected = subs.reduce((sum, s) => sum + (s.twilioUsage?.projectedCost || 0), 0);
                const maxCost = subs.reduce((sum, s) => sum + (s.twilioUsage?.maxCost || 0), 0);
                const netRevenue = revenue - refDiscounts - cost;
                const projNet = revenue - refDiscounts - projected;
                const maxNet = revenue - refDiscounts - maxCost;
                return (
                <div className="tally-billing-card">
                  <h3>Twilio Usage</h3>
                  <div className="tally-referral-summary" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                    <div className="tally-referral-stat">
                      <span className="tally-referral-stat-value">${cost.toFixed(2)}</span>
                      <span className="tally-referral-stat-label">Actual Cost</span>
                    </div>
                    <div className="tally-referral-stat">
                      <span className="tally-referral-stat-value">${projected.toFixed(2)}</span>
                      <span className="tally-referral-stat-label">Projected Cost</span>
                    </div>
                    <div className="tally-referral-stat">
                      <span className="tally-referral-stat-value">${maxCost.toFixed(2)}</span>
                      <span className="tally-referral-stat-label">Max Cost</span>
                    </div>
                    <div className="tally-referral-stat">
                      <span className="tally-referral-stat-value" style={{ color: netRevenue >= 0 ? '#22c55e' : '#ef4444' }}>${netRevenue.toFixed(2)}</span>
                      <span className="tally-referral-stat-label">Net Profit (Actual)</span>
                    </div>
                    <div className="tally-referral-stat">
                      <span className="tally-referral-stat-value" style={{ color: projNet >= 0 ? '#22c55e' : '#ef4444' }}>${projNet.toFixed(2)}</span>
                      <span className="tally-referral-stat-label">Net Profit (Projected)</span>
                    </div>
                  </div>
                </div>
                );
              })()}

              {/* Plan Breakdown */}
              <div className="tally-billing-card">
                <h3>Plan Breakdown</h3>
                <div className="tally-referral-list">
                  {adminData.planBreakdown?.map(p => (
                    <div key={p.plan} className="tally-referral-item">
                      <div className="tally-referral-item-info">
                        <span className="tally-referral-item-name">{PLAN_INFO[p.plan]?.label || p.plan}</span>
                        <span className="tally-referral-item-date">${PLAN_INFO[p.plan]?.price || '?'}/mo per user</span>
                      </div>
                      <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>{p.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* All Subscribers */}
              <div className="tally-billing-card">
                <h3>Subscribers ({adminData.subscribers?.length || 0})</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border-color, #e5e7eb)', textAlign: 'left' }}>
                        <th style={{ padding: '8px 10px' }}>Name</th>
                        <th style={{ padding: '8px 10px' }}>Email</th>
                        <th style={{ padding: '8px 10px' }}>Plan</th>
                        <th style={{ padding: '8px 10px' }}>Status</th>
                        <th style={{ padding: '8px 10px' }}>Numbers</th>
                        <th style={{ padding: '8px 10px' }}>Dials</th>
                        <th style={{ padding: '8px 10px' }}>Calls</th>
                        <th style={{ padding: '8px 10px' }}>Min</th>
                        <th style={{ padding: '8px 10px' }}>SMS</th>
                        <th style={{ padding: '8px 10px' }}>$/Dial</th>
                        <th style={{ padding: '8px 10px' }}>$/Call</th>
                        <th style={{ padding: '8px 10px' }}>Cycle</th>
                        <th style={{ padding: '8px 10px' }}>Cost</th>
                        <th style={{ padding: '8px 10px' }}>Projected</th>
                        <th style={{ padding: '8px 10px' }}>Max Cost</th>
                        <th style={{ padding: '8px 10px' }}>Refs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Totals row */}
                      {(() => {
                        const subs = adminData.subscribers || [];
                        const activeSubs = subs.filter(s => s.status === 'active' || s.status === 'trialing');
                        const totRevenue = activeSubs.reduce((sum, s) => sum + (PLAN_INFO[s.plan]?.price || 0), 0);
                        const totDials = subs.reduce((sum, s) => sum + (s.twilioUsage?.totalDials || 0), 0);
                        const totCalls = subs.reduce((sum, s) => sum + (s.twilioUsage?.calls || 0), 0);
                        const totOutbound = subs.reduce((sum, s) => sum + (s.twilioUsage?.outboundCalls || 0), 0);
                        const totInbound = subs.reduce((sum, s) => sum + (s.twilioUsage?.inboundCalls || 0), 0);
                        const totMinutes = subs.reduce((sum, s) => sum + (s.twilioUsage?.minutes || 0), 0);
                        const totSms = subs.reduce((sum, s) => sum + (s.twilioUsage?.sms || 0), 0);
                        const totCost = subs.reduce((sum, s) => sum + (s.twilioUsage?.cost || 0), 0);
                        const totProjected = subs.reduce((sum, s) => sum + (s.twilioUsage?.projectedCost || 0), 0);
                        const totMax = subs.reduce((sum, s) => sum + (s.twilioUsage?.maxCost || 0), 0);
                        const totRefs = subs.reduce((sum, s) => sum + (s.referralCount || 0), 0);
                        const totNumbers = subs.reduce((sum, s) => sum + (s.phoneNumbers || 0), 0);
                        const avgCostPerDial = totDials > 0 ? totCost / totDials : 0;
                        const avgCostPerCall = totCalls > 0 ? totCost / totCalls : 0;
                        const totProfit = totRevenue - totCost;
                        const totProjProfit = totRevenue - totProjected;
                        const totMaxProfit = totRevenue - totMax;
                        return (
                          <tr style={{ borderBottom: '2px solid var(--border-color, #e5e7eb)', background: 'var(--bg-secondary, #f9fafb)', fontWeight: 600 }}>
                            <td style={{ padding: '8px 10px' }} colSpan={2}>Totals ({activeSubs.length} active)</td>
                            <td style={{ padding: '8px 10px' }}>${totRevenue}/mo</td>
                            <td style={{ padding: '8px 10px' }}></td>
                            <td style={{ padding: '8px 10px' }}>{totNumbers}</td>
                            <td style={{ padding: '8px 10px' }}>{totDials}</td>
                            <td style={{ padding: '8px 10px' }}>
                              <div>{totCalls}</div>
                              <div style={{ fontSize: '0.8em', fontWeight: 400, color: 'var(--text-secondary)' }}>{totOutbound} out / {totInbound} in</div>
                            </td>
                            <td style={{ padding: '8px 10px' }}>{totMinutes}</td>
                            <td style={{ padding: '8px 10px' }}>{totSms}</td>
                            <td style={{ padding: '8px 10px', fontSize: '0.9em' }}>{avgCostPerDial > 0 ? `$${avgCostPerDial.toFixed(4)}` : '—'}</td>
                            <td style={{ padding: '8px 10px', fontSize: '0.9em' }}>{avgCostPerCall > 0 ? `$${avgCostPerCall.toFixed(4)}` : '—'}</td>
                            <td style={{ padding: '8px 10px' }}></td>
                            <td style={{ padding: '8px 10px' }}>
                              <div>${totCost.toFixed(2)}</div>
                              <div style={{ fontSize: '0.8em', fontWeight: 400, color: totProfit >= 0 ? '#22c55e' : '#ef4444' }}>
                                {totProfit >= 0 ? '+' : ''}{totProfit.toFixed(2)}
                              </div>
                            </td>
                            <td style={{ padding: '8px 10px' }}>
                              <div>${totProjected.toFixed(2)}</div>
                              <div style={{ fontSize: '0.8em', fontWeight: 400, color: totProjProfit >= 0 ? '#22c55e' : '#ef4444' }}>
                                {totProjProfit >= 0 ? '+' : ''}{totProjProfit.toFixed(2)}
                              </div>
                            </td>
                            <td style={{ padding: '8px 10px' }}>
                              <div>${totMax.toFixed(2)}</div>
                              <div style={{ fontSize: '0.8em', fontWeight: 400, color: totMaxProfit >= 0 ? '#22c55e' : '#ef4444' }}>
                                {totMaxProfit >= 0 ? '+' : ''}{totMaxProfit.toFixed(2)}
                              </div>
                            </td>
                            <td style={{ padding: '8px 10px' }}>{totRefs}</td>
                          </tr>
                        );
                      })()}
                      {adminData.subscribers?.map(s => {
                        const planPrice = PLAN_INFO[s.plan]?.price || 0;
                        const isActive = s.status === 'active' || s.status === 'trialing';
                        const profit = isActive ? planPrice - (s.twilioUsage?.cost || 0) : 0;
                        const projProfit = isActive ? planPrice - (s.twilioUsage?.projectedCost || 0) : 0;
                        const maxProfit = isActive ? planPrice - (s.twilioUsage?.maxCost || 0) : 0;
                        const isExpanded = expandedRows.has(s.id);
                        const bd = s.twilioUsage?.breakdown || {};
                        return (
                        <React.Fragment key={s.id}>
                        <tr
                          style={{ borderBottom: isExpanded ? 'none' : '1px solid var(--border-color, #e5e7eb)', cursor: 'pointer' }}
                          onClick={() => setExpandedRows(prev => {
                            const next = new Set(prev);
                            next.has(s.id) ? next.delete(s.id) : next.add(s.id);
                            return next;
                          })}
                        >
                          <td style={{ padding: '8px 10px', fontWeight: 500 }}>
                            {isExpanded ? <FiChevronUp size={12} style={{ marginRight: 4 }} /> : <FiChevronDown size={12} style={{ marginRight: 4 }} />}
                            {s.firstName} {s.lastName}
                          </td>
                          <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>{s.email}</td>
                          <td style={{ padding: '8px 10px' }}>{PLAN_INFO[s.plan]?.label || s.plan || '—'}</td>
                          <td style={{ padding: '8px 10px' }}>
                            <span className={`tally-sub-status tally-sub-status-${s.status}`}>{s.status || 'none'}</span>
                          </td>
                          <td style={{ padding: '8px 10px' }}>{s.phoneNumbers || 0}</td>
                          <td style={{ padding: '8px 10px' }}>
                            {s.twilioUsage ? (
                              <div>
                                <div>{s.twilioUsage.totalDials}</div>
                                <div style={{ fontSize: '0.8em', color: 'var(--text-secondary)' }}>{s.twilioUsage.dialsPerDay}/day</div>
                              </div>
                            ) : '—'}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            {s.twilioUsage ? (
                              <div>
                                <div>{s.twilioUsage.calls}</div>
                                <div style={{ fontSize: '0.8em', color: 'var(--text-secondary)' }}>
                                  {s.twilioUsage.outboundCalls || 0} out / {s.twilioUsage.inboundCalls || 0} in
                                </div>
                              </div>
                            ) : '—'}
                          </td>
                          <td style={{ padding: '8px 10px' }}>{s.twilioUsage?.minutes ?? '—'}</td>
                          <td style={{ padding: '8px 10px' }}>{s.twilioUsage?.sms ?? '—'}</td>
                          <td style={{ padding: '8px 10px', fontSize: '0.9em' }}>
                            {s.twilioUsage?.costPerDial ? `$${s.twilioUsage.costPerDial.toFixed(4)}` : '—'}
                          </td>
                          <td style={{ padding: '8px 10px', fontSize: '0.9em' }}>
                            {s.twilioUsage?.costPerCall ? `$${s.twilioUsage.costPerCall.toFixed(4)}` : '—'}
                          </td>
                          <td style={{ padding: '8px 10px', fontSize: '0.85em', color: 'var(--text-secondary)' }}>
                            {s.twilioUsage?.billingCycle ? (
                              <div title={`${s.twilioUsage.billingCycle.start ? new Date(s.twilioUsage.billingCycle.start).toLocaleDateString() : '?'} – ${s.twilioUsage.billingCycle.end ? new Date(s.twilioUsage.billingCycle.end).toLocaleDateString() : '?'}`}>
                                Day {s.twilioUsage.billingCycle.daysElapsed}/{s.twilioUsage.billingCycle.totalDays}
                                <div style={{ fontSize: '0.85em' }}>{s.twilioUsage.billingCycle.daysRemaining}d left</div>
                              </div>
                            ) : '—'}
                          </td>
                          <td style={{ padding: '8px 10px', fontWeight: s.twilioUsage?.cost > 0 ? 500 : 400 }}>
                            {s.twilioUsage ? (
                              <div>
                                <div>${s.twilioUsage.cost.toFixed(2)}</div>
                                {isActive && <div style={{ fontSize: '0.8em', color: profit >= 0 ? '#22c55e' : '#ef4444' }}>
                                  {profit >= 0 ? '+' : ''}{profit.toFixed(2)}
                                </div>}
                              </div>
                            ) : '—'}
                          </td>
                          <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>
                            {s.twilioUsage?.projectedCost != null ? (
                              <div>
                                <div>${s.twilioUsage.projectedCost.toFixed(2)}</div>
                                {isActive && <div style={{ fontSize: '0.8em', color: projProfit >= 0 ? '#22c55e' : '#ef4444' }}>
                                  {projProfit >= 0 ? '+' : ''}{projProfit.toFixed(2)}
                                </div>}
                              </div>
                            ) : '—'}
                          </td>
                          <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>
                            {s.twilioUsage?.maxCost ? (
                              <div>
                                <div>${s.twilioUsage.maxCost.toFixed(2)}</div>
                                {isActive && <div style={{ fontSize: '0.8em', color: maxProfit >= 0 ? '#22c55e' : '#ef4444' }}>
                                  {maxProfit >= 0 ? '+' : ''}{maxProfit.toFixed(2)}
                                </div>}
                              </div>
                            ) : '—'}
                          </td>
                          <td style={{ padding: '8px 10px' }}>{s.referralCount || 0}</td>
                        </tr>
                        {isExpanded && (
                          <tr style={{ borderBottom: '1px solid var(--border-color, #e5e7eb)', background: 'var(--bg-secondary, #f9fafb)' }}>
                            <td colSpan={16} style={{ padding: '10px 20px' }}>
                              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '0.82rem' }}>
                                {[
                                  { label: 'Voice', value: bd.callsCost },
                                  { label: 'AMD', value: bd.amdCost },
                                  { label: 'CNAM/Lookups', value: bd.lookupsCost },
                                  { label: 'Conference', value: bd.conferenceCost },
                                  { label: 'Phone Numbers', value: bd.numbersCost },
                                  { label: 'TTS (Polly)', value: bd.pollyCost },
                                  { label: 'Recordings', value: bd.recordingsCost },
                                  { label: 'SMS', value: bd.smsCost },
                                  { label: 'Other', value: bd.otherCost },
                                ].filter(item => (item.value || 0) > 0).map(item => (
                                  <div key={item.label} style={{ textAlign: 'center', minWidth: 70 }}>
                                    <div style={{ fontWeight: 600, fontSize: '1em' }}>${(item.value || 0).toFixed(2)}</div>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85em' }}>{item.label}</div>
                                  </div>
                                ))}
                                <div style={{ textAlign: 'center', minWidth: 70, borderLeft: '1px solid var(--border-color, #e5e7eb)', paddingLeft: 16 }}>
                                  <div style={{ fontWeight: 700, fontSize: '1em' }}>${(s.twilioUsage?.cost || 0).toFixed(2)}</div>
                                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85em' }}>Total</div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                        </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Referral Activity */}
              {adminData.recentReferrals?.length > 0 && (
                <div className="tally-billing-card">
                  <h3>Recent Referrals</h3>
                  <div className="tally-referral-list">
                    {adminData.recentReferrals.map(r => (
                      <div key={r.id} className="tally-referral-item">
                        <div className="tally-referral-item-info">
                          <span className="tally-referral-item-name">{r.referrerName} &rarr; {r.refereeName}</span>
                          <span className="tally-referral-item-date">{new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                        <span className={`tally-referral-item-status tally-referral-item-status-${r.status}`}>
                          {r.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button className="tally-btn tally-btn-secondary tally-btn-sm" onClick={fetchAdminData} style={{ marginTop: 8 }}>
                <FiRefreshCw /> Refresh
              </button>
            </>
          ) : (
            <div className="tally-msg tally-msg-error">Failed to load admin data.</div>
          )}
        </div>
      )}
    </div>
  );
};

export default TallyTab;
