import React, { useState, useEffect, useRef } from 'react';
import { FiSearch, FiInfo, FiX, FiAlertTriangle, FiPackage, FiActivity, FiPlus, FiChevronDown, FiChevronUp, FiCheckCircle, FiCopy } from 'react-icons/fi';
import api from '../../api';
import './MedicationSearch.css';

const MedicationSearch = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ medications: [], conditions: [] });
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [clientProfile, setClientProfile] = useState({
    medications: [],
    conditions: [],
    ageRange: '', // Changed from dob to ageRange
    heightFeet: '',
    heightInches: '',
    weight: '',
    gender: '',
    coverageAmount: ''
  });
  const [viewingItem, setViewingItem] = useState(null); // For detailed view modal
  const [viewingType, setViewingType] = useState(null); // 'medication' or 'condition'
  const searchRef = useRef(null);

  // Condition-specific questions based on auto trial guidelines
  const conditionQuestions = {
    'ADHD/ADD': [
      { id: 'age', question: 'Is the applicant 8 years old or younger?', type: 'boolean' },
      { id: 'diagnosedYoung', question: 'Was the applicant diagnosed before age 8?', type: 'boolean' }
    ],
    'Addison\'s Disease': [
      { id: 'hospitalizedLastYear', question: 'Hospitalized within the last year?', type: 'boolean' }
    ],
    'Asthma': [
      { id: 'hospitalizedTwoYears', question: 'Hospitalized due to asthma within 2 years?', type: 'boolean' }
    ],
    'Cancer': [
      { id: 'diagnosedWithin5Years', question: 'Diagnosed with cancer within 5 years?', type: 'boolean' },
      { id: 'breastOrColonWithin10', question: 'Breast or colon cancer within 10 years?', type: 'boolean' },
      { id: 'cancerType', question: 'Type of cancer', type: 'select', options: ['Basal Cell Skin Cancer', 'Squamous Cell Skin Cancer', 'Breast Cancer', 'Colon Cancer', 'Prostate Cancer', 'Lung Cancer', 'Melanoma', 'Lymphoma', 'Leukemia', 'Thyroid Cancer', 'Bladder Cancer', 'Kidney Cancer', 'Pancreatic Cancer', 'Ovarian Cancer', 'Uterine Cancer', 'Testicular Cancer', 'Other'] },
      { id: 'isBasalOrSquamous', question: 'Is it basal or squamous skin cancer?', type: 'boolean' }
    ],
    'Crohn\'s Disease/Colitis': [
      { id: 'surgeryRequired', question: 'Has surgery been required?', type: 'boolean' },
      { id: 'diagnosedWithin1Year', question: 'Diagnosed within 1 year?', type: 'boolean' },
      { id: 'okayWithRating', question: 'Okay with $5 per thousand rating?', type: 'boolean' }
    ],
    'Depression': [
      { id: 'hospitalized', question: 'Has been hospitalized for depression?', type: 'boolean' },
      { id: 'disabled', question: 'Has been disabled due to depression?', type: 'boolean' },
      { id: 'missedWork', question: 'Missed time from work due to depression?', type: 'boolean' },
      { id: 'takingPainMeds', question: 'Taking depression meds WITH pain medication?', type: 'boolean' },
      { id: 'seeingPsychiatrist', question: 'Currently seeing psychologist/psychiatrist?', type: 'boolean' }
    ],
    'Anxiety': [
      { id: 'hospitalized', question: 'Has been hospitalized for anxiety?', type: 'boolean' },
      { id: 'disabled', question: 'Has been disabled due to anxiety?', type: 'boolean' },
      { id: 'missedWork', question: 'Missed time from work due to anxiety?', type: 'boolean' },
      { id: 'takingPainMeds', question: 'Taking anxiety meds WITH pain medication?', type: 'boolean' },
      { id: 'seeingPsychiatrist', question: 'Currently seeing psychologist/psychiatrist?', type: 'boolean' }
    ],
    'Diabetes Type 1': [
      { id: 'insulinDependent', question: 'Is insulin dependent?', type: 'boolean' },
      { id: 'okayWithRating', question: 'Okay with $5 per thousand rating?', type: 'boolean' },
      { id: 'hasHighBloodPressure', question: 'Also has high blood pressure?', type: 'boolean' }
    ],
    'Diabetes Type 2': [
      { id: 'takes1000mgPlus', question: 'Takes 1,000mg or more of any medication?', type: 'boolean' },
      { id: 'seesDocYearly', question: 'Sees doctor at least once a year?', type: 'boolean' },
      { id: 'weightTable', question: 'Weight table rating', type: 'select', options: ['Table 1', 'Table 2', 'Table 3', 'Table 4+'] },
      { id: 'okayWithRating', question: 'Okay with $5 per thousand rating?', type: 'boolean' },
      { id: 'hasHighBloodPressure', question: 'Also has high blood pressure?', type: 'boolean' }
    ],
    'Heart Attack': [
      { id: 'hadHeartAttack', question: 'Has had a heart attack?', type: 'boolean' }
    ],
    'High Blood Pressure': [
      { id: 'hospitalizedWithin2Years', question: 'Hospitalized in last 2 years for blood pressure?', type: 'boolean' },
      { id: 'numberOfMeds', question: 'Number of HBP medications', type: 'select', options: ['1', '2', '3', '4', '5+'] },
      { id: 'hasDiabetes', question: 'Also has diabetes?', type: 'boolean' }
    ],
    'Hepatitis': [
      { id: 'currentTreatment', question: 'Currently in treatment?', type: 'boolean' },
      { id: 'isHepC', question: 'Is it Hepatitis C?', type: 'boolean' }
    ],
    'Seizures': [
      { id: 'seizureWithin2Years', question: 'Seizures within last 2 years?', type: 'boolean' },
      { id: 'grandMalWithin5Years', question: 'Grand Mal seizure in past 5 years?', type: 'boolean' }
    ],
    'Seizures/Epilepsy': [
      { id: 'seizureWithin2Years', question: 'Seizures within last 2 years?', type: 'boolean' },
      { id: 'grandMalWithin5Years', question: 'Grand Mal seizure in past 5 years?', type: 'boolean' }
    ],
    'Stroke/TIA': [
      { id: 'strokeWithin2Years', question: 'Stroke within 2 years?', type: 'boolean' },
      { id: 'twoOrMoreStrokes', question: '2 or more strokes ever?', type: 'boolean' }
    ],
    'Stroke or TIA': [
      { id: 'strokeWithin2Years', question: 'Stroke within 2 years?', type: 'boolean' },
      { id: 'twoOrMoreStrokes', question: '2 or more strokes ever?', type: 'boolean' }
    ],
    'High Blood Pressure (Hypertension)': [
      { id: 'hospitalizedWithin2Years', question: 'Hospitalized in last 2 years for blood pressure?', type: 'boolean' },
      { id: 'numberOfMeds', question: 'Number of HBP medications', type: 'select', options: ['1', '2', '3', '4', '5+'] },
      { id: 'hasDiabetes', question: 'Also has diabetes?', type: 'boolean' }
    ],
    'Weight': [
      { id: 'weightTable', question: 'Weight table rating', type: 'select', options: ['Table 1', 'Table 2', 'Table 3', 'Table 4', 'Table 5', 'Table 6', 'Table 7', 'Table 8', 'Table 9', 'Table 10', 'Table 11', 'Table 12+'] },
      { id: 'coverageAmount', question: 'Coverage amount requested', type: 'select', options: ['Under 100k', 'Over 100k', 'Senior Graded'] }
    ],
    'Recent Surgery': [
      { id: 'surgeryTiming', question: 'When was/will surgery be done?', type: 'select', options: ['Within 6 months', 'During underwriting', 'Over 6 months ago'] }
    ],
    'Autism and Asperger\'s': [
      { id: 'autoTrial', question: 'All cases are auto trial', type: 'boolean' }
    ],
    'Atrial Fibrillation': [
      { id: 'autoTrial', question: 'Automatic trial - requires medical review', type: 'boolean' }
    ],
    'Blood Clots (DVT/Pulmonary Embolism)': [
      { id: 'hasHistory', question: 'Has history of blood clots?', type: 'boolean' },
      { id: 'currentTreatment', question: 'Currently on blood thinners?', type: 'boolean' }
    ],
    'COPD (Chronic Obstructive Pulmonary Disease)': [
      { id: 'autoTrial', question: 'Automatic trial - chronic lung disease', type: 'boolean' },
      { id: 'oxygenUse', question: 'Requires oxygen use?', type: 'boolean' }
    ],
    'Bipolar Disorder': [
      { id: 'autoTrial', question: 'All bipolar cases are auto trial', type: 'boolean' },
      { id: 'hospitalized', question: 'Has been hospitalized?', type: 'boolean' },
      { id: 'stable', question: 'Condition is stable with medication?', type: 'boolean' }
    ],
    'Schizophrenia': [
      { id: 'autoTrial', question: 'All cases are auto trial', type: 'boolean' },
      { id: 'hospitalized', question: 'Has been hospitalized?', type: 'boolean' }
    ],
    'Multiple Sclerosis': [
      { id: 'autoTrial', question: 'Automatic trial - requires review', type: 'boolean' },
      { id: 'mobility', question: 'Has mobility impairment?', type: 'boolean' }
    ],
    'Parkinson\'s Disease': [
      { id: 'autoTrial', question: 'Automatic trial - requires review', type: 'boolean' },
      { id: 'yearsDiagnosed', question: 'Years since diagnosis', type: 'select', options: ['Less than 1 year', '1-2 years', '3-5 years', '6-10 years', 'More than 10 years'] }
    ],
    'Lupus': [
      { id: 'autoTrial', question: 'Automatic trial - autoimmune condition', type: 'boolean' },
      { id: 'organInvolvement', question: 'Organ involvement present?', type: 'boolean' }
    ],
    'Kidney Disease': [
      { id: 'isDialysis', question: 'On kidney dialysis?', type: 'boolean' },
      { id: 'kidneyStones', question: 'Is it only kidney stones?', type: 'boolean' }
    ],
    'Chronic Pain': [
      { id: 'autoTrial', question: 'Automatic trial - requires review', type: 'boolean' },
      { id: 'controlledSubstances', question: 'Taking controlled substances/opioids?', type: 'boolean' },
      { id: 'painManagement', question: 'Under pain management care?', type: 'boolean' }
    ],
    'Neuropathy': [
      { id: 'autoTrial', question: 'Automatic trial - requires review', type: 'boolean' },
      { id: 'cause', question: 'Cause of neuropathy', type: 'select', options: ['Diabetic', 'Idiopathic', 'Chemotherapy-induced', 'Alcoholic', 'Hereditary', 'Injury/Trauma', 'Other'] }
    ],
    'Osteoporosis': [
      { id: 'isSevere', question: 'Severe osteoporosis?', type: 'boolean' },
      { id: 'multipleFractures', question: 'Has had multiple fractures?', type: 'boolean' }
    ],
    'High Cholesterol': [
      { id: 'wellControlled', question: 'Well-controlled with medication?', type: 'boolean' },
      { id: 'levels', question: 'Current cholesterol level range', type: 'select', options: ['Under 200 (Normal)', '200-239 (Borderline High)', '240+ (High)', 'Unknown'] }
    ],
    'GERD/Acid Reflux': [
      { id: 'wellControlled', question: 'Well-controlled with medication?', type: 'boolean' },
      { id: 'complications', question: 'Any complications (Barrett\'s, etc.)?', type: 'boolean' }
    ],
    'Hypothyroidism': [
      { id: 'wellControlled', question: 'Well-controlled with medication?', type: 'boolean' },
      { id: 'regularTesting', question: 'Gets regular thyroid testing?', type: 'boolean' }
    ],
    'Allergies': [
      { id: 'seasonal', question: 'Only seasonal allergies?', type: 'boolean' },
      { id: 'anaphylaxis', question: 'History of anaphylaxis?', type: 'boolean' }
    ],
    'Insomnia': [
      { id: 'associatedMentalHealth', question: 'Associated with mental health condition?', type: 'boolean' },
      { id: 'psychiatricCare', question: 'Under psychiatric care?', type: 'boolean' }
    ],
    'Rheumatoid Arthritis': [
      { id: 'biologicMeds', question: 'Taking biologic medications?', type: 'boolean' },
      { id: 'severity', question: 'Severity level', type: 'select', options: ['Mild', 'Moderate', 'Severe'] },
      { id: 'okayWithRating', question: 'Okay with $5 per thousand rating?', type: 'boolean' }
    ],
    'Dementia/Alzheimer\'s': [
      { id: 'autoTrial', question: 'All cases are auto trial', type: 'boolean' },
      { id: 'stage', question: 'Stage of dementia', type: 'select', options: ['Early', 'Moderate', 'Advanced'] }
    ],
    'Chest Pain/Angina': [
      { id: 'erOrHospitalWithin2Years', question: 'Been to ER or hospitalized within 2 years?', type: 'boolean' },
      { id: 'okayWithRating', question: 'Okay with $5 per thousand rating?', type: 'boolean' }
    ]
  };

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch both medications and conditions
  useEffect(() => {
    const fetchResults = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults({ medications: [], conditions: [] });
        setShowResults(false);
        return;
      }

      try {
        setLoading(true);
        const [medsRes, condsRes] = await Promise.all([
          api.get(`/medications/search?q=${encodeURIComponent(searchQuery)}`),
          api.get(`/medications/conditions/search?q=${encodeURIComponent(searchQuery)}`)
        ]);

        setSearchResults({
          medications: medsRes.data?.success ? medsRes.data.data : [],
          conditions: condsRes.data?.success ? condsRes.data.data : []
        });
        setShowResults(true);
      } catch (err) {
        console.error('Error fetching results:', err);
        setSearchResults({ medications: [], conditions: [] });
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchResults, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  const handleViewMedication = (med) => {
    setViewingItem(med);
    setViewingType('medication');
  };

  const handleViewCondition = (condition) => {
    setViewingItem(condition);
    setViewingType('condition');
  };

  const handleCloseView = () => {
    setViewingItem(null);
    setViewingType(null);
  };

  const handleCopy = (text, event) => {
    if (event) {
      event.stopPropagation();
    }
    navigator.clipboard.writeText(text).then(() => {
      // Could add a toast notification here if desired
      console.log('Copied to clipboard:', text);
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  };

  const handleAddMedication = (med, event) => {
    if (event) {
      event.stopPropagation();
    }
    // Check if already added
    if (clientProfile.medications.some(m => m.brandName === med.brandName)) {
      return;
    }

    setClientProfile(prev => ({
      ...prev,
      medications: [...prev.medications, { ...med, expanded: false, prescribedFor: '' }]
    }));
  };

  const handleMedicationConditionChange = (medIndex, conditionName) => {
    setClientProfile(prev => ({
      ...prev,
      medications: prev.medications.map((med, i) =>
        i === medIndex ? { ...med, prescribedFor: conditionName } : med
      )
    }));
  };

  const handleAddCondition = (condition, event) => {
    if (event) {
      event.stopPropagation();
    }
    // Check if already added
    if (clientProfile.conditions.some(c => c.condition === condition.condition)) {
      return;
    }

    setClientProfile(prev => ({
      ...prev,
      conditions: [
        ...prev.conditions,
        {
          ...condition,
          expanded: false,
          answers: {}
        }
      ]
    }));
  };

  const handleAddRelatedCondition = (relatedCondition, event) => {
    if (event) {
      event.stopPropagation();
    }
    // Check if already added
    if (clientProfile.conditions.some(c => c.condition === relatedCondition.condition)) {
      return;
    }

    // Transform related condition to the format needed for profile
    const conditionToAdd = {
      condition: relatedCondition.condition,
      severity: relatedCondition.severity,
      trialGuideline: relatedCondition.trialGuideline,
      expanded: false,
      answers: {}
    };

    setClientProfile(prev => ({
      ...prev,
      conditions: [...prev.conditions, conditionToAdd]
    }));
  };

  const handleRemoveMedication = (index) => {
    setClientProfile(prev => ({
      ...prev,
      medications: prev.medications.filter((_, i) => i !== index)
    }));
  };

  const handleRemoveCondition = (index) => {
    setClientProfile(prev => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index)
    }));
  };

  const toggleMedicationExpanded = (index) => {
    setClientProfile(prev => ({
      ...prev,
      medications: prev.medications.map((med, i) =>
        i === index ? { ...med, expanded: !med.expanded } : med
      )
    }));
  };

  const toggleConditionExpanded = (index) => {
    setClientProfile(prev => ({
      ...prev,
      conditions: prev.conditions.map((cond, i) =>
        i === index ? { ...cond, expanded: !cond.expanded } : cond
      )
    }));
  };

  const handleAnswerChange = (conditionIndex, questionId, value) => {
    setClientProfile(prev => ({
      ...prev,
      conditions: prev.conditions.map((cond, i) =>
        i === conditionIndex
          ? { ...cond, answers: { ...cond.answers, [questionId]: value } }
          : cond
      )
    }));
  };

  const handleProfileFieldChange = (field, value) => {
    setClientProfile(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Get representative age from age range for calculations
  const getAgeFromRange = (ageRange) => {
    if (!ageRange) return null;
    switch (ageRange) {
      case '0-17':
        return 10; // Mid-range representative
      case '18-59':
        return 40; // Mid-range representative
      case '60-80':
        return 65; // Representative senior age
      default:
        return null;
    }
  };

  // Calculate weight table rating based on height, weight, and gender
  const calculateWeightTable = (heightFeet, heightInches, weight, gender) => {
    if (!heightFeet || !weight || !gender) return null;
    
    const totalInches = parseInt(heightFeet) * 12 + parseInt(heightInches || 0);
    const weightNum = parseInt(weight);
    
    // Weight table data based on the image (simplified version for common heights)
    // Format: height in inches -> [T2, T3, T4, T5, T6, T8, T10, T12]
    const weightTables = {
      male: {
        56: [127, 139, 156, 180, 195, 208, 226, 241],
        57: [130, 143, 162, 187, 202, 213, 215, 230],
        58: [94, 139, 199, 204, 220, 218, 223, 228],
        59: [97, 143, 206, 211, 216, 226, 231, 236],
        60: [100, 148, 213, 218, 223, 233, 239, 244],
        61: [104, 152, 220, 227, 231, 241, 247, 252],
        62: [107, 157, 227, 233, 238, 249, 255, 260],
        63: [111, 162, 235, 240, 246, 257, 263, 269],
        64: [114, 167, 242, 248, 254, 266, 271, 277],
        65: [119, 172, 250, 256, 262, 274, 280, 286],
        66: [121, 177, 258, 264, 270, 282, 289, 295],
        67: [125, 182, 265, 272, 278, 291, 297, 304],
        68: [129, 187, 273, 280, 287, 300, 306, 313],
        69: [133, 193, 282, 289, 296, 309, 315, 322],
        70: [136, 198, 290, 297, 304, 318, 325, 332],
        71: [140, 204, 298, 305, 312, 327, 334, 341],
        72: [144, 209, 306, 314, 321, 336, 343, 351],
        73: [148, 215, 315, 323, 330, 345, 353, 361],
        74: [152, 221, 324, 332, 339, 355, 363, 370],
        75: [157, 227, 333, 341, 349, 365, 373, 381],
        76: [161, 233, 341, 350, 358, 374, 383, 391],
        77: [165, 238, 350, 359, 367, 384, 393, 401],
        78: [169, 244, 360, 368, 377, 394, 403, 412],
        79: [174, 250, 369, 378, 387, 404, 413, 422],
        80: [178, 257, 379, 387, 396, 415, 424, 433],
        81: [182, 263, 388, 397, 406, 425, 434, 444]
      }
    };
    
    if (gender === 'Male' && weightTables.male[totalInches]) {
      const ranges = weightTables.male[totalInches];
      if (weightNum < ranges[0]) return 1;
      if (weightNum <= ranges[1]) return 2;
      if (weightNum <= ranges[2]) return 3;
      if (weightNum <= ranges[3]) return 4;
      if (weightNum <= ranges[4]) return 5;
      if (weightNum <= ranges[5]) return 6;
      if (weightNum <= ranges[6]) return 8;
      if (weightNum <= ranges[7]) return 10;
      return 12;
    }
    
    // Simplified calculation if exact height not in table
    return null;
  };

  const age = getAgeFromRange(clientProfile.ageRange);
  const weightTable = calculateWeightTable(clientProfile.heightFeet, clientProfile.heightInches, clientProfile.weight, clientProfile.gender);
  const isSenior = clientProfile.ageRange === '60-80';

  // Calculate if condition triggers auto trial
  const calculateConditionTrial = (condition) => {
    const questions = conditionQuestions[condition.condition];
    if (!questions) return { isTrial: false, reason: 'No specific guidelines' };

    const answers = condition.answers;

    // Same logic as before
    switch (condition.condition) {
      case 'ADHD/ADD':
        if (answers.age === true || answers.diagnosedYoung === true) {
          return { isTrial: true, reason: 'Age 8 or younger, or diagnosed before age 8' };
        }
        break;
      case 'Addison\'s Disease':
        if (answers.hospitalizedLastYear === true) {
          return { isTrial: true, reason: 'Hospitalized within the last year' };
        }
        break;
      case 'Asthma':
        if (answers.hospitalizedTwoYears === true) {
          return { isTrial: true, reason: 'Hospitalized due to asthma within 2 years' };
        }
        break;
      case 'Cancer':
        const cancerType = answers.cancerType || '';
        
        // Basal or Squamous skin cancer is NOT an auto trial
        if (cancerType === 'Basal Cell Skin Cancer' || cancerType === 'Squamous Cell Skin Cancer' || answers.isBasalOrSquamous === true) {
          return { isTrial: false, reason: 'Basal/squamous skin cancer does not auto trial - 10-20K advised' };
        }
        
        // Breast or Colon cancer within 10 years is auto trial
        if (answers.breastOrColonWithin10 === true) {
          return { isTrial: true, reason: 'Breast or colon cancer within 10 years' };
        }
        
        // Any other cancer within 5 years is auto trial
        if (answers.diagnosedWithin5Years === true) {
          return { isTrial: true, reason: 'Cancer diagnosed within 5 years' };
        }
        
        // If cancer type is selected but no timeline info, show as trial to be safe
        if (cancerType && cancerType !== '') {
          return { isTrial: true, reason: 'Cancer diagnosis - please confirm timeline' };
        }
        break;
      case 'Chest Pain':
      case 'Chest Pain/Angina':
        if (answers.erOrHospitalWithin2Years === true) {
          return { isTrial: true, reason: 'ER or hospitalized within 2 years' };
        }
        if (answers.okayWithRating === false) {
          return { isTrial: true, reason: 'Not okay with $5 per thousand rating' };
        }
        break;
      case 'Crohn\'s Disease/Colitis':
        if (answers.diagnosedWithin1Year === true) {
          return { isTrial: false, reason: 'DECLINE - Diagnosed within 1 year' };
        }
        if (answers.surgeryRequired === true || answers.okayWithRating === false) {
          return { isTrial: true, reason: 'Surgery required or not okay with rating' };
        }
        break;
      case 'Depression':
      case 'Anxiety':
        if (answers.hospitalized === true || answers.disabled === true || answers.missedWork === true || answers.takingPainMeds === true || answers.seeingPsychiatrist === true) {
          return { isTrial: true, reason: 'Meets auto trial criteria for mental health' };
        }
        break;
      case 'Diabetes Type 1':
      case 'Diabetes Type 2':
        if (answers.insulinDependent === true) {
          return { isTrial: true, reason: 'Insulin dependent' };
        }
        if (answers.takes1000mgPlus === true) {
          return { isTrial: true, reason: 'Takes 1,000mg+ of medication' };
        }
        if (answers.hasHighBloodPressure === true) {
          return { isTrial: true, reason: 'HBP + Diabetes combo is auto trial' };
        }
        // Parse weight table from dropdown (e.g., "Table 3" -> 3)
        const diabetesWeightTable = answers.weightTable ? parseInt(answers.weightTable.replace(/\D/g, '')) : 0;
        if (answers.seesDocYearly === false || diabetesWeightTable >= 3) {
          return { isTrial: true, reason: 'Doesn\'t see doctor yearly or high weight table' };
        }
        if (answers.okayWithRating === false) {
          return { isTrial: true, reason: 'Not okay with $5 per thousand rating' };
        }
        break;
      case 'Heart Attack':
        return { isTrial: true, reason: 'All heart attacks must be trialed' };
      case 'High Blood Pressure':
      case 'High Blood Pressure (Hypertension)':
        if (answers.hospitalizedWithin2Years === true) {
          return { isTrial: true, reason: 'Hospitalized within 2 years' };
        }
        // Parse number of meds from dropdown (e.g., "3" or "5+" -> number)
        const numMeds = answers.numberOfMeds ? (answers.numberOfMeds === '5+' ? 5 : parseInt(answers.numberOfMeds)) : 0;
        if (numMeds >= 3) {
          return { isTrial: true, reason: 'Taking 3 or more HBP medications' };
        }
        if (answers.hasDiabetes === true) {
          return { isTrial: true, reason: 'HBP + Diabetes combo is auto trial' };
        }
        break;
      case 'Hepatitis':
        if (answers.currentTreatment === true || answers.isHepC === true) {
          return { isTrial: true, reason: 'Current treatment or Hepatitis C' };
        }
        break;
      case 'Seizures':
      case 'Seizures/Epilepsy':
        if (answers.seizureWithin2Years === true || answers.grandMalWithin5Years === true) {
          return { isTrial: true, reason: 'Recent seizure activity' };
        }
        break;
      case 'Stroke/TIA':
      case 'Stroke or TIA':
        if (answers.strokeWithin2Years === true || answers.twoOrMoreStrokes === true) {
          return { isTrial: true, reason: 'Recent stroke or multiple strokes' };
        }
        break;
      case 'Weight':
        const coverage = answers.coverageAmount;
        // Parse weight table from dropdown (e.g., "Table 3" or "Table 12+" -> number)
        const weightTableStr = answers.weightTable || '';
        let table = 0;
        if (weightTableStr.includes('12+')) {
          table = 13; // Treat 12+ as 13 for comparison
        } else {
          table = parseInt(weightTableStr.replace(/\D/g, '')) || 0;
        }
        
        if (coverage === 'Senior Graded' && table > 12) {
          return { isTrial: true, reason: 'Over T12 for Senior Graded' };
        }
        if (coverage === 'Over 100k' && table >= 2) {
          return { isTrial: true, reason: 'Table 2+ for coverage over 100k' };
        }
        if (table >= 4) {
          return { isTrial: true, reason: 'Table 4 or higher weight rating' };
        }
        break;
      case 'Recent Surgery':
        if (answers.surgeryTiming === 'Within 6 months' || answers.surgeryTiming === 'During underwriting') {
          return { isTrial: true, reason: 'Surgery within 6 months or during underwriting' };
        }
        break;
      
      // Auto trial conditions - always trial
      case 'Autism and Asperger\'s':
      case 'Atrial Fibrillation':
      case 'COPD (Chronic Obstructive Pulmonary Disease)':
      case 'Bipolar Disorder':
      case 'Schizophrenia':
      case 'Multiple Sclerosis':
      case 'Parkinson\'s Disease':
      case 'Lupus':
      case 'Chronic Pain':
      case 'Neuropathy':
      case 'Dementia/Alzheimer\'s':
        return { isTrial: true, reason: 'Automatic trial condition' };
      
      case 'Blood Clots (DVT/Pulmonary Embolism)':
        return { isTrial: true, reason: 'History of blood clots - automatic trial' };
      
      case 'Kidney Disease':
        if (answers.isDialysis === true) {
          return { isTrial: true, reason: 'Kidney dialysis - automatic trial' };
        }
        if (answers.kidneyStones === false || !answers.kidneyStones) {
          return { isTrial: true, reason: 'Kidney disease (not just stones) - automatic trial' };
        }
        break;
      
      case 'Osteoporosis':
        if (answers.isSevere === true || answers.multipleFractures === true) {
          return { isTrial: true, reason: 'Severe osteoporosis or multiple fractures' };
        }
        break;
      
      case 'High Cholesterol':
        if (answers.wellControlled === false) {
          return { isTrial: true, reason: 'High cholesterol not well-controlled' };
        }
        break;
      
      case 'GERD/Acid Reflux':
        if (answers.complications === true) {
          return { isTrial: true, reason: 'GERD with complications' };
        }
        break;
      
      case 'Hypothyroidism':
        if (answers.wellControlled === false) {
          return { isTrial: true, reason: 'Hypothyroidism not well-controlled' };
        }
        break;
      
      case 'Allergies':
        if (answers.anaphylaxis === true) {
          return { isTrial: true, reason: 'History of anaphylaxis' };
        }
        break;
      
      case 'Insomnia':
        if (answers.psychiatricCare === true) {
          return { isTrial: true, reason: 'Insomnia with psychiatric care' };
        }
        break;
      
      case 'Rheumatoid Arthritis':
        if (answers.biologicMeds === true) {
          return { isTrial: true, reason: 'Taking biologic medications' };
        }
        if (answers.severity === 'Severe') {
          return { isTrial: true, reason: 'Severe rheumatoid arthritis' };
        }
        if (answers.okayWithRating === false) {
          return { isTrial: true, reason: 'Not okay with $5 per thousand rating' };
        }
        break;
    }

    return { isTrial: false, reason: 'Does not meet auto trial criteria' };
  };

  // Calculate overall trial status
  const calculateOverallStatus = () => {
    const autoTrialMeds = clientProfile.medications.filter(med => med.autoTrial);
    const trialConditions = clientProfile.conditions.filter(cond => {
      const result = calculateConditionTrial(cond);
      return result.isTrial;
    });

    let isAutoTrial = autoTrialMeds.length > 0 || trialConditions.length > 0;
    const reasons = [];

    if (autoTrialMeds.length > 0) {
      reasons.push(`${autoTrialMeds.length} auto trial medication(s)`);
    }
    if (trialConditions.length > 0) {
      reasons.push(`${trialConditions.length} condition(s) trigger trial`);
    }

    // Check weight table auto trial rules
    if (weightTable !== null && age !== null) {
      // T4+ and age 59+ = auto trial
      if (weightTable >= 4 && age >= 59) {
        isAutoTrial = true;
        reasons.push(`Weight Table ${weightTable} with age range ${clientProfile.ageRange}`);
      }
    }

    // Check high blood pressure + T3 = auto trial
    const hasHighBloodPressure = clientProfile.conditions.some(cond => 
      cond.condition === 'High Blood Pressure' || cond.condition === 'High Blood Pressure (Hypertension)'
    );
    if (hasHighBloodPressure && weightTable !== null && weightTable >= 3) {
      isAutoTrial = true;
      reasons.push(`High Blood Pressure with Weight Table ${weightTable}`);
    }

    // Check coverage $120k+ and T3+ = auto trial
    const coverageNum = parseInt(clientProfile.coverageAmount) || 0;
    if (coverageNum >= 120000 && weightTable !== null && weightTable >= 3) {
      isAutoTrial = true;
      reasons.push(`Coverage $${coverageNum.toLocaleString()} with Weight Table ${weightTable}`);
    }

    // Determine if trial is based purely on demographics
    const demographicsOnly = reasons.length > 0 && autoTrialMeds.length === 0 && trialConditions.length === 0;
    
    let recommendation = '';
    if (isAutoTrial) {
      recommendation = 'This application should be submitted as a TRIAL';
      if (demographicsOnly) {
        recommendation += ' (based on demographics)';
      }
    } else {
      recommendation = 'This application may be submitted STANDARD (pending full underwriting review)';
    }

    return {
      isAutoTrial,
      reasons,
      recommendation
    };
  };

  const overallStatus = calculateOverallStatus();
  const hasItems = clientProfile.medications.length > 0 || clientProfile.conditions.length > 0;
  const hasDemographics = clientProfile.ageRange || clientProfile.weight || clientProfile.coverageAmount;

  return (
    <div className="unified-medication-container">
      {/* Header */}
      <div className="settings-header" style={{ marginBottom: '12px' }}>
        <h1 className="settings-section-title">Trial Toolkit</h1>
      </div>

      <div className="medication-search-description">
        <p>Search for medications or conditions, click for details, add to build a client profile, and get instant auto trial determination.</p>
      </div>

      {/* Client Demographics - Above Both Panels */}
      <div className="profile-demographics-top">
        <h4>Client Information (Optional)</h4>
        <div className="demographics-grid-top">
          <div className="demo-field">
            <label>Age Range</label>
            <select
              value={clientProfile.ageRange}
              onChange={(e) => handleProfileFieldChange('ageRange', e.target.value)}
            >
              <option value="">Select age range...</option>
              <option value="0-17">0-17 (Child)</option>
              <option value="18-59">18-59 (Super Combo)</option>
              <option value="60-80">60-80 (Senior)</option>
            </select>
          </div>
          <div className="demo-field">
            <label>Gender</label>
            <select
              value={clientProfile.gender}
              onChange={(e) => handleProfileFieldChange('gender', e.target.value)}
            >
              <option value="">Select...</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
          <div className="demo-field">
            <label>Height</label>
            <div className="height-inputs">
              <select
                value={clientProfile.heightFeet}
                onChange={(e) => handleProfileFieldChange('heightFeet', e.target.value)}
              >
                <option value="">Ft</option>
                {[4, 5, 6, 7].map(ft => (
                  <option key={ft} value={ft}>{ft}</option>
                ))}
              </select>
              <select
                value={clientProfile.heightInches}
                onChange={(e) => handleProfileFieldChange('heightInches', e.target.value)}
              >
                <option value="">In</option>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(inch => (
                  <option key={inch} value={inch}>{inch}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="demo-field">
            <label>Weight (lbs)</label>
            <input
              type="number"
              value={clientProfile.weight}
              onChange={(e) => handleProfileFieldChange('weight', e.target.value)}
              placeholder="Weight"
              min="0"
            />
          </div>
          <div className="demo-field">
            <label>Coverage Amount</label>
            <select
              value={clientProfile.coverageAmount}
              onChange={(e) => handleProfileFieldChange('coverageAmount', e.target.value)}
            >
              <option value="">Select...</option>
              <option value="10000">$10,000</option>
              <option value="15000">$15,000</option>
              <option value="20000">$20,000</option>
              <option value="25000">$25,000</option>
              <option value="30000">$30,000</option>
              <option value="40000">$40,000</option>
              <option value="50000">$50,000</option>
              <option value="75000">$75,000</option>
              <option value="100000">$100,000</option>
              <option value="120000">$120,000</option>
              <option value="150000">$150,000</option>
              <option value="200000">$200,000</option>
              <option value="250000">$250,000</option>
              <option value="300000">$300,000</option>
              <option value="500000">$500,000</option>
            </select>
          </div>
        </div>
        {(weightTable !== null || clientProfile.coverageAmount) && (
          <div className="calculated-info">
            {weightTable !== null && (
              <span><strong>Weight Table:</strong> Table {weightTable}</span>
            )}
            {clientProfile.coverageAmount && (
              <span><strong>Coverage:</strong> ${parseInt(clientProfile.coverageAmount).toLocaleString()}</span>
            )}
          </div>
        )}
      </div>

      <div className="unified-layout">
        {/* Left: Search Panel */}
        <div className="search-panel">
          <div className="search-panel-header">
            <h3>Search & Add</h3>
          </div>

          {/* Search Box */}
          <div className="medication-search-wrapper" ref={searchRef}>
            <div className="medication-search-input-container">
              <FiSearch className="medication-search-icon" />
              <input
                type="text"
                placeholder="Search medications or conditions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => (searchResults.medications.length > 0 || searchResults.conditions.length > 0) && setShowResults(true)}
                className="medication-search-input"
              />
              {loading && (
                <div className="medication-search-loading">
                  <div className="loading-spinner-small"></div>
                </div>
              )}
              {searchQuery && (
                <button
                  className="medication-search-clear"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults({ medications: [], conditions: [] });
                    setShowResults(false);
                  }}
                  title="Clear search"
                >
                  <FiX size={16} />
                </button>
              )}
            </div>

            {/* Combined Results Dropdown */}
            {showResults && (searchResults.medications.length > 0 || searchResults.conditions.length > 0) && (
              <div className="unified-results-dropdown">
                {/* Medications Section */}
                {searchResults.medications.length > 0 && (
                  <div className="results-section">
                    <div className="results-section-header">
                      <FiPackage size={14} /> Medications
                    </div>
                    {searchResults.medications.map((med, index) => (
                      <div key={index} className="result-item" onClick={() => handleViewMedication(med)}>
                        <div className="result-item-content">
                          <div className="result-item-title">
                            <span className="result-brand-name">{med.brandName}</span>
                            {/* Show matched alternative name if it's not brand or generic */}
                            {med.matchedName && med.matchedName !== 'brand' && med.matchedName !== 'generic' && (
                              <span className="result-generic-name">({med.matchedName})</span>
                            )}
                            {/* Show generic name if different from brand */}
                            {med.genericName && med.genericName !== med.brandName && (
                              <span className="result-generic-name">({med.genericName})</span>
                            )}
                            {med.autoTrial && (
                              <span className="auto-trial-badge-small">
                                <FiAlertTriangle size={10} /> Trial
                              </span>
                            )}
                          </div>
                          <div className="result-item-preview">{med.uses?.substring(0, 60)}...</div>
                        </div>
                        <div className="result-item-actions">
                          <button
                            className="copy-item-btn"
                            onClick={(e) => handleCopy(med.brandName, e)}
                            title="Copy medication name"
                          >
                            <FiCopy /> Copy
                          </button>
                          <button
                            className="add-item-btn"
                            onClick={(e) => handleAddMedication(med, e)}
                            title="Add to client profile"
                          >
                            <FiPlus />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Conditions Section */}
                {searchResults.conditions.length > 0 && (
                  <div className="results-section">
                    <div className="results-section-header">
                      <FiActivity size={14} /> Conditions
                    </div>
                    {searchResults.conditions.map((cond, index) => (
                      <div key={index} className="result-item" onClick={() => handleViewCondition(cond)}>
                        <div className="result-item-content">
                          <div className="result-item-title">
                            <span className="result-brand-name">{cond.condition}</span>
                            <span className="severity-badge-tiny" style={{ backgroundColor: getSeverityColor(cond.severity) }}>
                              {cond.severity}
                            </span>
                          </div>
                          <div className="result-item-preview">{cond.trialGuideline?.substring(0, 60)}...</div>
                        </div>
                        <div className="result-item-actions">
                          <button
                            className="copy-item-btn"
                            onClick={(e) => handleCopy(cond.condition, e)}
                            title="Copy condition name"
                          >
                            <FiCopy /> Copy
                          </button>
                          <button
                            className="add-item-btn"
                            onClick={(e) => handleAddCondition(cond, e)}
                            title="Add to client profile"
                          >
                            <FiPlus />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* No results */}
            {showResults && searchQuery.length >= 2 && searchResults.medications.length === 0 && searchResults.conditions.length === 0 && !loading && (
              <div className="unified-results-dropdown">
                <div className="medication-no-results">
                  No results found for "{searchQuery}"
                </div>
              </div>
            )}
          </div>

          {/* Empty state for search panel */}
          {!searchQuery && (
            <div className="search-panel-empty">
              <FiSearch size={32} />
              <p>Start typing to search medications or conditions</p>
            </div>
          )}
        </div>

        {/* Right: Client Profile Builder */}
        <div className="profile-panel">
          {/* Overall Status Banner */}
          {(hasItems || hasDemographics) && (
            <div className={`trial-status-banner-compact ${overallStatus.isAutoTrial ? 'trial' : 'standard'}`}>
              <div className="status-icon-compact">
                {overallStatus.isAutoTrial ? <FiAlertTriangle size={20} /> : <FiCheckCircle size={20} />}
              </div>
              <div className="status-content-compact">
                <h3>{overallStatus.isAutoTrial ? 'AUTO TRIAL' : 'STANDARD'}</h3>
                <p>{overallStatus.recommendation}</p>
                {overallStatus.reasons.length > 0 && (
                  <div className="trial-reasons">
                    {overallStatus.reasons.map((reason, idx) => (
                      <div key={idx} className="trial-reason-item">• {reason}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Client Profile Content */}
          {!hasItems ? (
            <div className="profile-panel-empty">
              <FiInfo size={48} />
              <h3>No Items Added</h3>
              <p>Search and add medications or conditions from the left panel to build a client profile</p>
            </div>
          ) : (
            <div className="profile-content">
              {/* Medications List */}
              {clientProfile.medications.length > 0 && (
                <div className="profile-section-compact">
                  <h4><FiPackage size={16} /> Medications ({clientProfile.medications.length})</h4>
                  {clientProfile.medications.map((med, idx) => (
                    <div key={idx} className="profile-item-card">
                      <div className="profile-item-header" onClick={() => toggleMedicationExpanded(idx)}>
                        <div className="profile-item-title">
                          <span>{med.brandName}</span>
                          {med.alternativeNames && med.alternativeNames.length > 0 && (
                            <span className="result-generic-name">({med.alternativeNames.join(', ')})</span>
                          )}
                          {med.prescribedFor && (
                            <span className="prescribed-for-badge">
                              For: {med.prescribedFor}
                            </span>
                          )}
                          {med.autoTrial && (
                            <span className="auto-trial-badge-small">
                              <FiAlertTriangle size={10} /> Auto Trial
                            </span>
                          )}
                        </div>
                        <div className="profile-item-actions">
                          <button className="copy-btn-profile" onClick={(e) => handleCopy(med.brandName, e)} title="Copy medication name">
                            <FiCopy size={12} /> Copy
                          </button>
                          <button className="expand-btn-small" onClick={(e) => { e.stopPropagation(); toggleMedicationExpanded(idx); }}>
                            {med.expanded ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
                          </button>
                          <button className="remove-btn-small" onClick={(e) => { e.stopPropagation(); handleRemoveMedication(idx); }}>
                            <FiX size={16} />
                          </button>
                        </div>
                      </div>
                      {med.expanded && (
                        <div className="profile-item-content">
                          <p className="med-uses">{med.uses}</p>
                          
                          {/* Condition Selection */}
                          {clientProfile.conditions.length > 0 && (
                            <div className="medication-condition-selector">
                              <label><strong>Prescribed for:</strong></label>
                              <select
                                value={med.prescribedFor || ''}
                                onChange={(e) => handleMedicationConditionChange(idx, e.target.value)}
                              >
                                <option value="">Select condition (optional)</option>
                                {clientProfile.conditions.map((cond, condIdx) => (
                                  <option key={condIdx} value={cond.condition}>
                                    {cond.condition}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                          
                          {med.autoTrial && (
                            <div className="auto-trial-info">
                              <FiAlertTriangle size={14} />
                              <span>{med.autoTrial.reason}</span>
                            </div>
                          )}
                          {med.conditionsAndGuidelines && med.conditionsAndGuidelines.length > 0 && (
                            <div className="related-conditions">
                              <strong>Related Conditions:</strong>
                              {med.conditionsAndGuidelines.map((c, i) => (
                                <div key={i} className="related-condition-item">
                                  <div className="related-condition-info">
                                    <span>{c.condition}</span>
                                    <span className="severity-badge-tiny" style={{ backgroundColor: getSeverityColor(c.severity) }}>
                                      {c.severity}
                                    </span>
                                  </div>
                                  {!clientProfile.conditions.some(cond => cond.condition === c.condition) && (
                                    <button
                                      className="add-related-btn"
                                      onClick={(e) => handleAddRelatedCondition(c, e)}
                                      title="Add condition to profile"
                                    >
                                      <FiPlus size={12} /> Add
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Conditions List */}
              {clientProfile.conditions.length > 0 && (
                <div className="profile-section-compact">
                  <h4><FiActivity size={16} /> Conditions ({clientProfile.conditions.length})</h4>
                  {clientProfile.conditions.map((cond, idx) => {
                    const trialResult = calculateConditionTrial(cond);
                    const questions = conditionQuestions[cond.condition] || [];

                    return (
                      <div key={idx} className={`profile-item-card condition ${trialResult.isTrial ? 'trial' : 'standard'}`}>
                        <div className="profile-item-header" onClick={() => toggleConditionExpanded(idx)}>
                          <div className="profile-item-title">
                            <span>{cond.condition}</span>
                            <span className={`status-badge-tiny ${trialResult.isTrial ? 'trial' : 'standard'}`}>
                              {trialResult.isTrial ? 'TRIAL' : 'STD'}
                            </span>
                          </div>
                          <div className="profile-item-actions">
                            <button className="copy-btn-profile" onClick={(e) => handleCopy(cond.condition, e)} title="Copy condition name">
                              <FiCopy size={12} /> Copy
                            </button>
                            <button className="expand-btn-small" onClick={(e) => { e.stopPropagation(); toggleConditionExpanded(idx); }}>
                              {cond.expanded ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
                            </button>
                            <button className="remove-btn-small" onClick={(e) => { e.stopPropagation(); handleRemoveCondition(idx); }}>
                              <FiX size={16} />
                            </button>
                          </div>
                        </div>
                        {cond.expanded && (
                          <div className="profile-item-content">
                            <div className="condition-questions-compact">
                              {questions.map((q) => (
                                <div key={q.id} className="question-item-compact">
                                  <label>{q.question}</label>
                                  {q.type === 'boolean' && (
                                    <div className="boolean-buttons-compact">
                                      <button
                                        className={`bool-btn-compact ${cond.answers[q.id] === true ? 'active yes' : ''}`}
                                        onClick={() => handleAnswerChange(idx, q.id, true)}
                                      >
                                        Yes
                                      </button>
                                      <button
                                        className={`bool-btn-compact ${cond.answers[q.id] === false ? 'active no' : ''}`}
                                        onClick={() => handleAnswerChange(idx, q.id, false)}
                                      >
                                        No
                                      </button>
                                    </div>
                                  )}
                                  {q.type === 'text' && (
                                    <input
                                      type="text"
                                      value={cond.answers[q.id] || ''}
                                      onChange={(e) => handleAnswerChange(idx, q.id, e.target.value)}
                                      placeholder="Enter answer..."
                                    />
                                  )}
                                  {q.type === 'number' && (
                                    <input
                                      type="number"
                                      value={cond.answers[q.id] || ''}
                                      onChange={(e) => handleAnswerChange(idx, q.id, parseInt(e.target.value))}
                                      placeholder="Enter number..."
                                    />
                                  )}
                                  {q.type === 'select' && (
                                    <select
                                      value={cond.answers[q.id] || ''}
                                      onChange={(e) => handleAnswerChange(idx, q.id, e.target.value)}
                                    >
                                      <option value="">Select...</option>
                                      {q.options.map((opt) => (
                                        <option key={opt} value={opt}>{opt}</option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                              ))}
                            </div>
                            <div className={`trial-determination-compact ${trialResult.isTrial ? 'trial' : 'standard'}`}>
                              <strong>Result:</strong> {trialResult.reason}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Detail View Modal */}
      {viewingItem && (
        <div className="detail-modal-overlay" onClick={handleCloseView}>
          <div className="detail-modal" onClick={(e) => e.stopPropagation()}>
            <button className="detail-modal-close" onClick={handleCloseView}>
              <FiX size={24} />
            </button>

            {viewingType === 'medication' ? (
              // Medication Details
              <div className="detail-modal-content">
                <div className="detail-modal-header">
                  <h2>{viewingItem.brandName}</h2>
                  {viewingItem.genericName && viewingItem.genericName !== viewingItem.brandName && (
                    <span className="detail-generic">Generic: {viewingItem.genericName}</span>
                  )}
                </div>

                {viewingItem.autoTrial && (
                  <div className="auto-trial-warning">
                    <FiAlertTriangle size={20} />
                    <div>
                      <h4>Auto Trial Medication</h4>
                      <p>{viewingItem.autoTrial.reason}</p>
                    </div>
                  </div>
                )}

                {viewingItem.alternativeNames && viewingItem.alternativeNames.length > 0 && (
                  <div className="detail-section">
                    <h3><FiInfo size={16} /> Also Known As</h3>
                    <div className="alternative-names-grid">
                      {viewingItem.alternativeNames.map((name, idx) => (
                        <span key={idx} className="alt-name-badge">{name}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="detail-section">
                  <h3>What it's used for</h3>
                  <p>{viewingItem.uses}</p>
                </div>

                {viewingItem.conditionsAndGuidelines && viewingItem.conditionsAndGuidelines.length > 0 && (
                  <div className="detail-section">
                    <h3><FiAlertTriangle size={16} /> Auto Trial Guidelines</h3>
                    {viewingItem.conditionsAndGuidelines.map((cond, idx) => (
                      <div key={idx} className="guideline-box">
                        <div className="guideline-header">
                          <span className="condition-name">{cond.condition}</span>
                          <span className="severity-badge-tiny" style={{ backgroundColor: getSeverityColor(cond.severity) }}>
                            {cond.severity} risk
                          </span>
                        </div>
                        <p>{cond.trialGuideline}</p>
                      </div>
                    ))}
                  </div>
                )}

                {viewingItem.additionalInfo && (
                  <div className="detail-section">
                    <h3>Additional Information</h3>
                    <p>{viewingItem.additionalInfo}</p>
                  </div>
                )}

                <div className="detail-modal-actions">
                  <button 
                    className="btn-add-large"
                    onClick={() => {
                      handleAddMedication(viewingItem);
                      handleCloseView();
                    }}
                  >
                    <FiPlus /> Add to Client Profile
                  </button>
                </div>
              </div>
            ) : (
              // Condition Details
              <div className="detail-modal-content">
                <div className="detail-modal-header">
                  <h2>{viewingItem.condition}</h2>
                  <span className="severity-badge-large" style={{ backgroundColor: getSeverityColor(viewingItem.severity) }}>
                    {viewingItem.severity} trial risk
                  </span>
                </div>

                <div className="auto-trial-warning">
                  <FiAlertTriangle size={20} />
                  <div>
                    <h4>Auto Trial Guideline</h4>
                    <p>{viewingItem.trialGuideline}</p>
                  </div>
                </div>

                {viewingItem.medications && viewingItem.medications.length > 0 && (
                  <div className="detail-section">
                    <h3><FiPackage size={16} /> Common Medications</h3>
                    <div className="medications-grid">
                      {viewingItem.medications.map((med, idx) => (
                        <div key={idx} className="med-card">
                          <div className="med-card-header">
                            <strong>{med.brandName}</strong>
                            {med.genericName && med.genericName !== med.brandName && (
                              <span className="med-generic">({med.genericName})</span>
                            )}
                          </div>
                          <p className="med-uses">{med.uses}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="detail-modal-actions">
                  <button 
                    className="btn-add-large"
                    onClick={() => {
                      handleAddCondition(viewingItem);
                      handleCloseView();
                    }}
                  >
                    <FiPlus /> Add to Client Profile
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  function getSeverityColor(severity) {
    switch (severity) {
      case 'high': return '#ef4444';
      case 'moderate-high': return '#f59e0b';
      case 'moderate': return '#fbbf24';
      case 'low-moderate': return '#84cc16';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  }
};

export default MedicationSearch;
