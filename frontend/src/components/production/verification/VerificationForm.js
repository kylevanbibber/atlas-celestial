import React, { useState } from 'react';
import ClientInfo from './ClientInfo';
import ProposedInsureds from './InsuredInfo';
import api from '../../../api';

const VerificationForm = ({ onSubmitSuccess }) => {
  const [saleType, setSaleType] = useState('No');
  const [annualPremium, setAnnualPremium] = useState(0);
  const [selectedAgentId, setSelectedAgentId] = useState(null);
  const [loading, setLoading] = useState(false);

  // State to hold client info
  const [clientInfo, setClientInfo] = useState({
    name: '',
    phoneNumber: {
      areaCode: '',
      prefix: '',
      lineNumber: '',
    },
    email: {
      handle: '',
      website: '',
      domain: 'com',
    },
  });

  // State to hold agent info
  const [agentInfo, setAgentInfo] = useState({
    agentName: '',
    agentEmail: ''
  });

  // State to hold insured info
  const [insuredInfo, setInsuredInfo] = useState({
    primary: { firstName: '', lastName: '', trial: false, senior: false },
    spouse: null,
    children: [],
  });

  // State to hold premium info
  const [premiumInfo, setPremiumInfo] = useState({
    totalMonthlyPremium: 0,
    totalAnnualPremium: 0,
    trialMonthlyPremium: 0,
  });

  const [medicalAnswers, setMedicalAnswers] = useState({});
  const [seniorMedicalAnswers, setSeniorMedicalAnswers] = useState({});

  const transformDataForBackend = (
    clientInfo,
    agentInfo,
    insuredInfo,
    medicalAnswers = {},
    seniorMedicalAnswers = {},
    premiumInfo
  ) => {
    const { primary, spouse, children } = insuredInfo;
  
    const primaryName = `${primary.firstName} ${primary.lastName} ${primary.suffix || ''}`.trim();
    const primaryInfo = [
      primaryName || 'n/a',
      primary.mbd || '0',
      primary.trial ? 'y' : 'n',
      primary.senior ? 'y' : 'n',
    ].join(',');
  
    const spouseInfo = spouse
      ? [
          `${spouse.firstName} ${spouse.lastName} ${spouse.suffix || ''}`.trim() || 'n/a',
          spouse.mbd || '0',
          spouse.trial ? 'y' : 'n',
          spouse.senior ? 'y' : 'n',
        ].join(',')
      : 'n/a,0,n,n';
  
    const childrenInfo = Array.from({ length: 9 }, (_, i) => {
      const child = children[i];
      return child
        ? [
            `${child.firstName || ''} ${child.lastName || ''} ${child.suffix || ''}`.trim() || 'n/a',
            child.mbd || '0',
            child.trial ? 'y' : 'n',
          ].join(',')
        : 'n/a,0,n';
    });
  
    const allMedicalQuestions = [
      'dui',
      'arrested',
      'heart_issues',
      'high_blood_pressure',
      'diabetes',
      'anxiety_depression',
      'cancer',
      'medications',
      'er_visit',
      'chronic_illness',
    ];
  
    const allSeniorMedicalQuestions = [
      'senior_rejected',
      'heart_lung',
      'cirrhosis',
      'amputation',
      'cancer_senior',
      'oxygen',
    ];
  
    const medicalData = {};
  
    allMedicalQuestions.forEach((question) => {
      medicalData[`${question}_answer`] = medicalAnswers[question] || 'n';
    });
  
    allSeniorMedicalQuestions.forEach((question) => {
      medicalData[`${question}_answer`] = seniorMedicalAnswers[question] || 'n';
    });
  
    return {
      client_name: clientInfo.name || '',
      client_phoneNumber: `${clientInfo.phoneNumber.areaCode}-${clientInfo.phoneNumber.prefix}-${clientInfo.phoneNumber.lineNumber}`,
      client_email: `${clientInfo.email.handle}@${clientInfo.email.website}.${clientInfo.email.domain}`,
      agent_name: agentInfo.agentName || '',
      agent_email: agentInfo.agentEmail || '',
      primary_info: primaryInfo,
      spouse_info: spouseInfo,
      ...childrenInfo.reduce((acc, childData, index) => {
        acc[`child${index + 1}_info`] = childData;
        return acc;
      }, {}),
      ...medicalData,
      total_annual_premium: premiumInfo.totalAnnualPremium || 0,
      total_trial_premium: premiumInfo.trialMonthlyPremium || 0,
    };
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
  
    const transformedData = {
      ...transformDataForBackend(
        clientInfo,
        agentInfo,
        insuredInfo,
        medicalAnswers,
        seniorMedicalAnswers,
        premiumInfo
      ),
      userId: selectedAgentId,
    };
  
  
    // Use the atlas backend API
    api.post('/verify', transformedData)
      .then((response) => {
        alert('Verification form submitted successfully!');
        // Call the success callback instead of reloading
        if (onSubmitSuccess) {
          onSubmitSuccess();
        } else {
          window.location.reload();
        }
      })
      .catch((error) => {
        console.error('Error submitting the form:', error);
        alert('Failed to submit the verification form. Please try again.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <div className="verification-form-container">
      <form onSubmit={handleSubmit}>
        
        <ClientInfo 
          setClientInfo={setClientInfo} 
          setAgentInfo={setAgentInfo} 
          setSelectedAgentId={setSelectedAgentId}
        />
        
        <ProposedInsureds 
          setInsuredInfo={setInsuredInfo}
          setPremiumInfo={setPremiumInfo}
          setMedicalAnswers={setMedicalAnswers}
          setSeniorMedicalAnswers={setSeniorMedicalAnswers}
        />

        <p style={{ marginTop: '10px', fontSize: '12px' }}>
          Please note that submitting this form does not send no-cost benefits at this time. This functionality will return momentarily. In the meantime, please send your clients the no-cost benefits/policyholder packet.
        </p>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            marginTop: '15px',
            gap: '50px',
            fontSize: '12px'
          }}
        >
          <div>
            <p><strong>AIL Links:</strong></p>
            <span
              style={{ cursor: 'pointer', color: 'blue', textDecoration: 'underline' }}
              onClick={() => {
                navigator.clipboard.writeText('https://drive.google.com/drive/folders/1mTsYnWzpC2I7fvOBUpi_XqFB7BNm65Y_?usp=drive_link');
                alert('AIL No-Cost Benefits link copied to clipboard!');
              }}
            >
              Link to No-Cost Benefits
            </span>
            <br />
            <span
              style={{ cursor: 'pointer', color: 'blue', textDecoration: 'underline' }}
              onClick={() => {
                navigator.clipboard.writeText('https://drive.google.com/drive/folders/1gEJkPX99Ius5aOuJfTxl4o6evA0lqels?usp=drive_link');
                alert('AIL Policyholder Benefits link copied to clipboard!');
              }}
            >
              Link to Policyholder Benefits
            </span>
          </div>

          <div>
            <p><strong>NIL Links:</strong></p>
            <span
              style={{ cursor: 'pointer', color: 'blue', textDecoration: 'underline' }}
              onClick={() => {
                navigator.clipboard.writeText('https://drive.google.com/drive/folders/1FnypPtx7L-0db0e4TDHHO7q1nB8xW-yl?usp=drive_link');
                alert('NIL No-Cost Benefits link copied to clipboard!');
              }}
            >
              Link to No-Cost Benefits
            </span>
            <br />
            <span
              style={{ cursor: 'pointer', color: 'blue', textDecoration: 'underline' }}
              onClick={() => {
                navigator.clipboard.writeText('https://drive.google.com/drive/folders/1yLM9C5O6GDBByMKsU0xiicMfrwqSge4s?usp=drive_link');
                alert('NIL Policyholder Packet link copied to clipboard!');
              }}
            >
              Link to Policyholder Packet
            </span>
          </div>
        </div>

        <div className="button-container" style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '8px 16px',
              backgroundColor: loading ? '#ccc' : '#00558c',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              fontSize: '13px',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default VerificationForm; 