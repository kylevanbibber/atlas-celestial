import React, { useState, useEffect, useRef } from 'react';
import MedicalQuestions from './MedicalQuestions'; // Import Medical Questions component
import SeniorMedicalQuestions from './SeniorMedicalQuestions'; // Import Senior Medical Questions component
import './VerificationForm.css';
const InsuredInfo = ({ setInsuredInfo, setPremiumInfo, setMedicalAnswers, setSeniorMedicalAnswers }) => { // Add setMedicalAnswers here
  const [spouseAdded, setSpouseAdded] = useState(false);
  const [children, setChildren] = useState([]); // Tracks number of children
  const [childrenInfo, setChildrenInfo] = useState([]); // Tracks children information
  const [premiums, setPremiums] = useState({
    primary: 0,
    spouse: 0,
    children: [],
  });
  const [totalMonthlyPremium, setTotalMonthlyPremium] = useState(0);
  const [trialMonthlyPremium, setTrialMonthlyPremium] = useState(0); // For trial premiums
  const [totalAnnualPremium, setTotalAnnualPremium] = useState(0);
  // State for insured names and senior/trial status
  const [insureds, setInsureds] = useState({
    primary: { firstName: '', lastName: '', suffix: '', trial: false, senior: false },
    spouse: { firstName: '', lastName: '', suffix: '', trial: false, senior: false },
    children: [],
  });
  const suffixOptions = ['', 'Jr.', 'Sr.', 'III', 'IV', 'V', 'VI'];

  const [duplicateErrors, setDuplicateErrors] = useState({
    primary: false,
    spouse: false,
    children: [],
  });
  
  useEffect(() => {
    
    setInsuredInfo({
      primary: {
        ...insureds.primary,
        mbd: premiums.primary // Add MBD to primary insured
      },
      spouse: spouseAdded
        ? {
            ...insureds.spouse,
            mbd: premiums.spouse // Add MBD to spouse
          }
        : null,
      children: insureds.children.map((child, index) => ({
        ...child,
        mbd: premiums.children[index] || 0 // Add MBD to each child
      })),
    });
  }, [insureds, spouseAdded, premiums, setInsuredInfo]);
  
  
  const [spouseLastNameHint, setSpouseLastNameHint] = useState(''); // Hint for spouse last name
const [childrenLastNameHints, setChildrenLastNameHints] = useState([]); // Hints for children last names
const spouseLastNameRef = useRef(null); // Ref for the spouse last name hidden span
const childLastNameRefs = useRef([]); // Refs for each child's last name hidden spans

// Function to calculate the width of the input text
const calculateTextWidth = (text, elementRef) => {
  if (!elementRef || !elementRef.current) return 0; // Ensure ref is not null

  // Set the span's text content and measure its width
  elementRef.current.textContent = text;
  return elementRef.current.offsetWidth;
};


const addSpouse = () => {
  if (!spouseAdded) {
    setSpouseAdded(true);
    
    // If the primary last name is already filled, set the hint for spouse
    if (insureds.primary.lastName) {
      setSpouseLastNameHint(insureds.primary.lastName);
    }
  }
};



const addChild = () => {
  if (children.length < 9) {
    setChildren([...children, children.length + 1]);
    setChildrenInfo([...childrenInfo, { firstName: '', lastName: '' }]);
    setInsureds((prev) => ({
      ...prev,
      children: [...prev.children, { firstName: '', lastName: '', trial: false, senior: false }],
    }));

    // If the primary last name is already filled, set the hint for all children
    if (insureds.primary.lastName) {
      setChildrenLastNameHints([...childrenLastNameHints, insureds.primary.lastName]);
    }
  }
};



  // Remove spouse and reset spouse-related data
  const removeSpouse = () => {
    setSpouseAdded(false);
    setPremiums((prev) => ({
      ...prev,
      spouse: 0, // Reset spouse premium to 0
    }));
    setInsureds((prev) => ({
      ...prev,
      spouse: { firstName: '', lastName: '', trial: false, senior: false },
    }));
  };

  // Remove child and shift data
  const removeChild = (index) => {
    const updatedChildren = children.filter((_, i) => i !== index);
    const updatedChildrenInfo = childrenInfo.filter((_, i) => i !== index);
    const updatedInsuredChildren = insureds.children.filter((_, i) => i !== index);

    setChildren(updatedChildren);
    setChildrenInfo(updatedChildrenInfo);
    setInsureds((prev) => ({
      ...prev,
      children: updatedInsuredChildren,
    }));
  };

  // Handle premium input changes
  const handlePremiumChange = (e, type, index = null) => {
    const value = parseFloat(e.target.value) || 0;
    setPremiums((prev) => {
      if (type === 'primary') {
        return {
          ...prev,
          primary: value,
        };
      } else if (type === 'spouse') {
        return {
          ...prev,
          spouse: value,
        };
      } else if (type === 'child') {
        const updatedChildren = [...premiums.children];
        updatedChildren[index] = value;
        return {
          ...prev,
          children: updatedChildren,
        };
      }
      return prev;
    });
  };

  // Handle changes in children inputs
  const handleChildChange = (e, index, field) => {
    const value = e.target.value;
    const updatedChildrenInfo = [...childrenInfo];
    updatedChildrenInfo[index][field] = value;
    setChildrenInfo(updatedChildrenInfo);
    setInsureds((prev) => {
      const updatedInsuredChildren = [...prev.children];
      updatedInsuredChildren[index][field] = value;
      return { ...prev, children: updatedInsuredChildren };
    });
  };

  const handleLastNameAutocomplete = (e, type, index = null) => {
    if (e.key === 'Tab') {
      e.preventDefault();
  
      // Spouse autocomplete
      if (type === 'spouse' && spouseLastNameHint && insureds.spouse.lastName === '') {
        setInsureds((prev) => ({
          ...prev,
          spouse: { ...prev.spouse, lastName: spouseLastNameHint },
        }));
      } else if (
        type === 'spouse' &&
        insureds.spouse.lastName !== '' &&
        spouseLastNameHint.startsWith(insureds.spouse.lastName)
      ) {
        setInsureds((prev) => ({
          ...prev,
          spouse: { ...prev.spouse, lastName: spouseLastNameHint },
        }));
      }
  
      // Child autocomplete
      if (type === 'child' && childrenLastNameHints[index] && insureds.children[index]?.lastName === '') {
        setInsureds((prev) => {
          const updatedChildren = [...prev.children];
          updatedChildren[index].lastName = childrenLastNameHints[index];
          return { ...prev, children: updatedChildren };
        });
      } else if (
        type === 'child' &&
        insureds.children[index]?.lastName !== '' &&
        childrenLastNameHints[index].startsWith(insureds.children[index]?.lastName)
      ) {
        setInsureds((prev) => {
          const updatedChildren = [...prev.children];
          updatedChildren[index].lastName = childrenLastNameHints[index];
          return { ...prev, children: updatedChildren };
        });
      }
    }
  };
  
  const handlePrimaryChange = (e, field) => {
    const value = e.target.value;
    setInsureds((prev) => ({
      ...prev,
      primary: { ...prev.primary, [field]: value },
    }));
  
    if (field === 'lastName') {
      // Set the hint for both spouse and children when the primary's last name is entered
      setSpouseLastNameHint(value);
      setChildrenLastNameHints(Array(children.length).fill(value));
    }
  };
  
  
  
  const handleSpouseChange = (e, field) => {
    const value = e.target.value;
    setInsureds((prev) => ({
      ...prev,
      spouse: { ...prev.spouse, [field]: value },
    }));
  };

  // Toggle trial mode
  const toggleTrial = (type, index = null) => {
    if (type === 'primary') {
      setInsureds((prev) => ({
        ...prev,
        primary: { ...prev.primary, trial: !prev.primary.trial },
      }));
    } else if (type === 'spouse') {
      setInsureds((prev) => ({
        ...prev,
        spouse: { ...prev.spouse, trial: !prev.spouse.trial },
      }));
    } else if (type === 'child') {
      setInsureds((prev) => {
        const updatedChildren = [...prev.children];
        updatedChildren[index].trial = !updatedChildren[index].trial;
        return { ...prev, children: updatedChildren };
      });
    }
  };

  // Toggle senior status
  const toggleSenior = (type, index = null) => {
    if (type === 'primary') {
      setInsureds((prev) => ({
        ...prev,
        primary: { ...prev.primary, senior: !prev.primary.senior },
      }));
    } else if (type === 'spouse') {
      setInsureds((prev) => ({
        ...prev,
        spouse: { ...prev.spouse, senior: !prev.spouse.senior },
      }));
    } else if (type === 'child') {
      setInsureds((prev) => {
        const updatedChildren = [...prev.children];
        updatedChildren[index].senior = !updatedChildren[index].senior;
        return { ...prev, children: updatedChildren };
      });
    }
  };

useEffect(() => {
  const primaryMBD = insureds.primary.trial ? 0 : premiums.primary;
  const spouseMBD = insureds.spouse.trial ? 0 : premiums.spouse;
  const childrenMBD = premiums.children.reduce(
    (total, mbd, index) => total + (insureds.children[index]?.trial ? 0 : mbd),
    0
  );

  // Calculate trial premiums annually
  const trialPrimary = insureds.primary.trial ? premiums.primary * 12 : 0;
  const trialSpouse = insureds.spouse.trial ? premiums.spouse * 12 : 0;
  const trialChildren = premiums.children.reduce(
    (total, mbd, index) => total + (insureds.children[index]?.trial ? mbd * 12 : 0),
    0
  );

  const monthly = primaryMBD + spouseMBD + childrenMBD;
  const trialAnnual = trialPrimary + trialSpouse + trialChildren;

  // Set the monthly, annual, and trial values
  setTotalMonthlyPremium(monthly);
  setTrialMonthlyPremium(trialAnnual);
  setTotalAnnualPremium(monthly * 12);

  // Pass the premium data up to the parent
  setPremiumInfo({
    totalMonthlyPremium: monthly,
    totalAnnualPremium: monthly * 12,
    trialMonthlyPremium: trialAnnual,
  });
}, [premiums, insureds, setPremiumInfo]);

const validateDuplicateNames = () => {
  const allInsureds = [
    { ...insureds.primary, type: 'primary' },
    spouseAdded ? { ...insureds.spouse, type: 'spouse' } : null,
    ...insureds.children.map((child, index) => ({ ...child, type: 'child', index })),
  ].filter(Boolean); // Filter out null values (when spouse is not added)

  const duplicates = {
    primary: false,
    spouse: false,
    children: Array(insureds.children.length).fill(false),
  };

  allInsureds.forEach((insured, idx) => {
    allInsureds.forEach((other, otherIdx) => {
      if (
        idx !== otherIdx &&
        insured.firstName === other.firstName &&
        insured.lastName === other.lastName &&
        insured.suffix === other.suffix
      ) {
        if (insured.type === 'primary') duplicates.primary = true;
        if (insured.type === 'spouse') duplicates.spouse = true;
        if (insured.type === 'child') duplicates.children[insured.index] = true;
      }
    });
  });

  setDuplicateErrors(duplicates);
};

const inputStyle = (isDuplicate) => ({
  padding: '5px',
  border: `1px solid ${isDuplicate ? 'red' : '#ccc'}`,
  borderRadius: '5px',
  fontSize: '12px',
  boxSizing: 'border-box',
  fontFamily: 'Calibri, sans-serif',
});

  // Determine if medical questions and/or senior medical questions should be shown
  const shouldShowMedicalQuestions = totalAnnualPremium >= 1200;
  const shouldShowSeniorMedicalQuestions = insureds.primary.senior || (spouseAdded && insureds.spouse.senior);

  // Determine which question sets to display
  const questionSet = (() => {
    if (insureds.primary.senior && !spouseAdded && children.length === 0) {
      return 'senior'; // Show only senior medical questions when only primary is senior
    } else if (spouseAdded && insureds.primary.senior && insureds.spouse.senior && children.length === 0) {
      return 'senior'; // Show only senior medical questions when both primary and spouse are seniors and no children
    } else if (spouseAdded && insureds.primary.senior && insureds.spouse.senior && children.length > 0) {
      return 'both'; // Show both medical and senior questions when both are seniors and children are present
    } else if (insureds.primary.senior || insureds.spouse.senior) {
      return 'both'; // Show both medical and senior questions if either is senior
    } else {
      return 'medical'; // Show only medical questions when neither primary nor spouse is senior
    }
  })();

  return (
    <>
    <hr />
    <div className='client-info-group'>
      <h4>Proposed Insured Info</h4>
      </div>
      <div className="insured-button-container">
  {!spouseAdded && <button type="button" className='insured-button' onClick={addSpouse}>Add Spouse</button>}
  {spouseAdded && <button type="button" className='insured-button' onClick={removeSpouse}>Remove Spouse</button>}
  {children.length < 9 && <button type="button" className='insured-button' onClick={addChild}>Add Child</button>}
</div>

{/* Primary Insured */}
<div className="insured-group"  style={{marginBottom: '20px'}}>
  <div className="insured-label-checkboxes">
    <label className="insured-label">Primary Insured</label>
    <div className="checkbox-group">
      <label style={{fontSize: '12px'}}>
        <input type="checkbox" checked={insureds.primary.trial} onChange={() => toggleTrial('primary')} />
        Trial
      </label>
      <label style={{fontSize: '12px'}}>
        <input type="checkbox" checked={insureds.primary.senior} onChange={() => toggleSenior('primary')} />
        Senior
      </label>
    </div>
  </div>
  <div className="input-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>

  <input
  type="text"
  id="primary_insured_first"
  name="primary_insured_first"
  placeholder="First Name"
  onChange={(e) => handlePrimaryChange(e, 'firstName')}
  required
  autoComplete="off"
  style={{
    padding: '5px',
    border: '1px solid #ccc',
    borderRadius: '5px',
    fontSize: '12px',
    width: '30%',
    boxSizing: 'border-box',
    fontFamily: 'Calibri, sans-serif',
  }}
/>

<input
  type="text"
  id="primary_insured_last"
  name="primary_insured_last"
  placeholder="Last Name"
  onChange={(e) => handlePrimaryChange(e, 'lastName')}
  required
  autoComplete="off"
  style={{
    padding: '5px',
    border: '1px solid #ccc',
    borderRadius: '5px',
    fontSize: '12px',
    width: '40%',
    boxSizing: 'border-box',
    fontFamily: 'Calibri, sans-serif',
  }}
/>
<select
  id="primary_insured_suffix"
  name="primary_insured_suffix"
  value={insureds.primary.suffix}
  onChange={(e) => handlePrimaryChange(e, 'suffix')}
  style={{
    padding: '5px',
    border: '1px solid #ccc',
    borderRadius: '5px',
    fontSize: '12px',
    width: '10%',
    boxSizing: 'border-box',
    fontFamily: 'Calibri, sans-serif',
  }}
>
  {suffixOptions.map((option, index) => (
    <option key={index} value={option}>
      {option}
    </option>
  ))}
</select>

<input
  type="number"
  id="primary_insured_premium"
  name="primary_insured_premium"
  placeholder="MBD"
  step="0.01"
  onChange={(e) => handlePremiumChange(e, 'primary')}
  className="premium-input"
  required={!!(insureds.primary.firstName && insureds.primary.lastName)} // Make MBD required if both names are provided
  style={{
    padding: '5px',
    border: '1px solid #ccc',
    borderRadius: '5px',
    fontSize: '12px',
    width: '10%',
    boxSizing: 'border-box',
    fontFamily: 'Calibri, sans-serif',
  }}
/>
</div>
  </div>

{/* Spouse Insured */}
{spouseAdded && (
  <div className="insured-group" style={{marginBottom: '20px'}}>
    <hr />

    <div className="insured-label-checkboxes">
      <label className="insured-label">Spouse</label>
      <div className="checkbox-group">
        <label style={{fontSize: '12px'}}>
          <input type="checkbox" checked={insureds.spouse.trial} onChange={() => toggleTrial('spouse')} />
          Trial
        </label>
        <label style={{fontSize: '12px'}}>
          <input type="checkbox" checked={insureds.spouse.senior} onChange={() => toggleSenior('spouse')} />
          Senior
        </label>
      </div>
    </div>
    <div className="input-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>

      <input
        type="text"
        id="spouse_first"
        name="spouse_first"
        placeholder="First Name"
        onChange={(e) => handleSpouseChange(e, 'firstName')}
        required
        autoComplete="off"
        style={{
          padding: '5px',
          border: '1px solid #ccc',
          borderRadius: '5px',
          fontSize: '12px',
          width: '30%',
          boxSizing: 'border-box',
          fontFamily: 'Calibri, sans-serif',
        }}
      />
<div style={{ position: 'relative', width: '40%' }}>
  <input
    type="text"
    id="spouse_last"
    name="spouse_last"
    placeholder={spouseLastNameHint && insureds.spouse.lastName === '' ? '' : 'Last Name'}
    value={insureds.spouse.lastName}
    onChange={(e) => handleSpouseChange(e, 'lastName')}
    onKeyDown={(e) => handleLastNameAutocomplete(e, 'spouse')}
    required
    autoComplete="off"
    style={{
      padding: '5px',
      border: '1px solid #ccc',
      borderRadius: '5px',
      fontSize: '12px',
      width: '100%',
      boxSizing: 'border-box',
      fontFamily: 'Calibri, sans-serif',
      position: 'relative',
    }}
  />

  {/* Hidden span to calculate width */}
  <span
    ref={spouseLastNameRef}
    style={{
      visibility: 'hidden',
      position: 'absolute',
      whiteSpace: 'pre',
      fontFamily: 'Calibri, sans-serif',
      fontSize: '12px',
    }}
  >
    {insureds.spouse.lastName}
  </span>

  {/* Display the hint if conditions match */}
  {spouseLastNameHint && insureds.spouse.lastName !== spouseLastNameHint && spouseLastNameHint.startsWith(insureds.spouse.lastName) && (
    <span
      style={{
        position: 'absolute',
        top: '50%',
        left: `${calculateTextWidth(insureds.spouse.lastName, spouseLastNameRef) + 5}px`,
        transform: 'translateY(-50%)',
        color: '#ccc',
        pointerEvents: 'none',
        fontSize: '12px',
        fontFamily: 'inherit',
      }}
    >
      {spouseLastNameHint.substring(insureds.spouse.lastName.length)}
    </span>
  )}
</div>
<select
  id="spouse_suffix"
  name="spouse_suffix"
  value={insureds.spouse.suffix}
  onChange={(e) => handleSpouseChange(e, 'suffix')}
  style={{
    padding: '5px',
    border: '1px solid #ccc',
    borderRadius: '5px',
    fontSize: '12px',
    width: '10%',
    boxSizing: 'border-box',
    fontFamily: 'Calibri, sans-serif',
  }}
>
  {suffixOptions.map((option, index) => (
    <option key={index} value={option}>
      {option}
    </option>
  ))}
</select>

<input
  type="number"
  id="spouse_premium"
  name="spouse_premium"
  placeholder="MBD"
  step="0.01"
  onChange={(e) => handlePremiumChange(e, 'spouse')}
  required={spouseAdded && !!(insureds.spouse.firstName && insureds.spouse.lastName)} // Required if both names are provided and spouse is added
  style={{
    padding: '5px',
    border: '1px solid #ccc',
    borderRadius: '5px',
    fontSize: '12px',
    width: '10%',
    boxSizing: 'border-box',
    fontFamily: 'Calibri, sans-serif',
  }}
/>
    </div>
    </div>
)}



{/* Children Insured */}
<div className="children-insured">
  {children.map((_, index) => (
    <div key={index} className="insured-group">
      <hr />
      {/* Child label, trial checkbox, and remove button in the same row */}
      <div className="input-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label className="insured-label">{`Child ${index + 1}`}</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={insureds.children[index]?.trial || false}
              onChange={() => toggleTrial('child', index)}
            />
            Trial
          </label>
          <button
            type="button"
            onClick={() => removeChild(index)}
            style={{
              backgroundColor: '#00558c',
              color: 'white',
              border: 'none',
              padding: '3px 7px',
              cursor: 'pointer',
              borderRadius: '3px',
              fontSize: '10px',
              fontFamily: 'Calibri, sans-serif',
            }}
          >
            Remove
          </button>
        </div>
      </div>

      {/* Child inputs */}
      <div className="input-row" style={{ marginTop: '10px' }}>
        <input
          type="text"
          id={`child_first_${index}`}
          name={`child_first_${index}`}
          placeholder="First Name"
          value={childrenInfo[index]?.firstName || ''}
          onChange={(e) => handleChildChange(e, index, 'firstName')}
          required
          autoComplete="off"
          style={{
            padding: '5px',
            border: '1px solid #ccc',
            borderRadius: '5px',
            fontSize: '12px',
            width: '30%',
            boxSizing: 'border-box',
            fontFamily: 'Calibri, sans-serif',
          }}
        />
        <div style={{ position: 'relative', width: '40%' }}>
          <input
            type="text"
            id={`child_last_${index}`}
            name={`child_last_${index}`}
            placeholder={childrenLastNameHints[index] && insureds.children[index]?.lastName === '' ? '' : 'Last Name'}
            value={insureds.children[index]?.lastName || ''}
            onChange={(e) => handleChildChange(e, index, 'lastName')}
            onKeyDown={(e) => handleLastNameAutocomplete(e, 'child', index)}
            required
            autoComplete="off"
            style={{
              padding: '5px',
              border: '1px solid #ccc',
              borderRadius: '5px',
              fontSize: '12px',
              width: '100%',
              boxSizing: 'border-box',
              fontFamily: 'Calibri, sans-serif',
              position: 'relative',
            }}
          />

          {/* Hidden span to calculate width */}
          <span
            ref={(el) => (childLastNameRefs.current[index] = el)} // Assign ref for each child
            style={{
              visibility: 'hidden',
              position: 'absolute',
              whiteSpace: 'pre',
              fontFamily: 'Calibri, sans-serif',
              fontSize: '12px',
            }}
          >
            {insureds.children[index]?.lastName}
          </span>

          {/* Display the hint if conditions match */}
          {childrenLastNameHints[index] && insureds.children[index]?.lastName !== childrenLastNameHints[index] && childrenLastNameHints[index].startsWith(insureds.children[index]?.lastName) && (
            <span
              style={{
                position: 'absolute',
                top: '50%',
                left: `${calculateTextWidth(insureds.children[index]?.lastName, childLastNameRefs.current[index]) + 5}px`,
                transform: 'translateY(-50%)',
                color: '#ccc',
                pointerEvents: 'none',
                fontSize: '12px',
                fontFamily: 'inherit',
              }}
            >
              {childrenLastNameHints[index].substring(insureds.children[index]?.lastName.length)}
            </span>
          )}
        </div>
        <select
  id={`child_suffix_${index}`}
  name={`child_suffix_${index}`}
  value={insureds.children[index]?.suffix || ''}
  onChange={(e) => handleChildChange(e, index, 'suffix')}
  style={{
    padding: '5px',
    border: '1px solid #ccc',
    borderRadius: '5px',
    fontSize: '12px',
    width: '10%',
    boxSizing: 'border-box',
    fontFamily: 'Calibri, sans-serif',
  }}
>
  {suffixOptions.map((option, index) => (
    <option key={index} value={option}>
      {option}
    </option>
  ))}
</select>

        {/* MBD Input */}
        <input
    key={`child_mbd_${index}`}
    type="number"
    className="premium-input"
    id={`child_premium_${index}`}
    name={`child_premium_${index}`}
    placeholder="MBD"
    step="0.01"
    value={premiums.children[index] || ''}
    onChange={(e) => handlePremiumChange(e, 'child', index)}
    required={!!(insureds.children[index]?.firstName && insureds.children[index]?.lastName)} // Required if both names are provided
    style={{
      padding: '5px',
      border: '1px solid #ccc',
      borderRadius: '5px',
      fontSize: '12px',
      width: '10%',
      boxSizing: 'border-box',
      fontFamily: 'Calibri, sans-serif',
    }}
  />
      </div>
    </div>
  ))}
</div>


<hr />
{/* Premium Information */}
<div className="premiums-container">
  <div className="premium-row">
    <div className="premium-item">
      <label style={{fontSize: '14px', fontFamily: 'Calibri'}}>Total MBD Premium</label>
      <input type="text" id="monthly_premium" name="monthly_premium" value={totalMonthlyPremium.toFixed(2)} readOnly />
    </div>
    <div className="premium-item">
      <label style={{fontSize: '12px', fontFamily: 'Calibri'}}>Total Annual Premium</label>
      <input type="text" id="annual_premium" name="annual_premium" value={totalAnnualPremium.toFixed(2)} readOnly />
    </div>
    <div className="premium-item">
      <label style={{fontSize: '12px', fontFamily: 'Calibri'}}>Trial Monthly Premium</label>
      <input type="text" id="trial_monthly_premium" name="trial_monthly_premium" value={trialMonthlyPremium.toFixed(2)} readOnly />
    </div>
  </div>
</div>

{totalAnnualPremium >= 1200 && questionSet === 'medical' && shouldShowMedicalQuestions && (
        <MedicalQuestions
          insureds={insureds.children
            .filter(child => !child.senior)
            .concat(
              !insureds.primary.senior
                ? [{ name: `${insureds.primary.firstName} ${insureds.primary.lastName}`, isSenior: insureds.primary.senior }]
                : []
            )
            .concat(
              spouseAdded && !insureds.spouse.senior
                ? [{ name: `${insureds.spouse.firstName} ${insureds.spouse.lastName}`, isSenior: insureds.spouse.senior }]
                : []
            )}
          setMedicalAnswers={setMedicalAnswers} // Pass setMedicalAnswers to MedicalQuestions
        />
      )}

{totalAnnualPremium >= 1200 && questionSet === 'senior' && (
  <SeniorMedicalQuestions
    insureds={insureds.children
      .filter(child => child.senior)
      .concat(
        insureds.primary.senior
          ? [{ name: `${insureds.primary.firstName} ${insureds.primary.lastName}`, isSenior: insureds.primary.senior }]
          : []
      )
      .concat(
        spouseAdded && insureds.spouse.senior
          ? [{ name: `${insureds.spouse.firstName} ${insureds.spouse.lastName}`, isSenior: insureds.spouse.senior }]
          : []
      )}
    setSeniorMedicalAnswers={setSeniorMedicalAnswers}  // Pass setSeniorMedicalAnswers to SeniorMedicalQuestions if needed
  />
)}

{totalAnnualPremium >= 1200 && questionSet === 'both' && (
  <>
    <SeniorMedicalQuestions
      insureds={insureds.children
        .filter(child => child.senior)
        .concat(
          insureds.primary.senior
            ? [{ name: `${insureds.primary.firstName} ${insureds.primary.lastName}`, isSenior: insureds.primary.senior }]
            : []
        )
        .concat(
          spouseAdded && insureds.spouse.senior
            ? [{ name: `${insureds.spouse.firstName} ${insureds.spouse.lastName}`, isSenior: insureds.spouse.senior }]
            : []
        )}
      setSeniorMedicalAnswers={setSeniorMedicalAnswers}  // Pass setSeniorMedicalAnswers to SeniorMedicalQuestions
    />
    <MedicalQuestions
      insureds={insureds.children
        .filter(child => !child.senior)
        .concat(
          !insureds.primary.senior
            ? [{ name: `${insureds.primary.firstName} ${insureds.primary.lastName}`, isSenior: insureds.primary.senior }]
            : []
        )
        .concat(
          spouseAdded && !insureds.spouse.senior
            ? [{ name: `${insureds.spouse.firstName} ${insureds.spouse.lastName}`, isSenior: insureds.spouse.senior }]
            : []
        )}
      setMedicalAnswers={setMedicalAnswers}  // Pass setMedicalAnswers to MedicalQuestions
    />
  </>
)}
    </>
  );
};

export default InsuredInfo;
