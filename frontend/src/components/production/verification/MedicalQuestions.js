import React, { useState, useEffect } from 'react';

const MedicalQuestions = ({ insureds, setMedicalAnswers }) => {
  const [answers, setAnswers] = useState({
    dui: 'n',
    arrested: 'n',
    heart_issues: 'n',
    high_blood_pressure: 'n',
    diabetes: 'n',
    anxiety_depression: 'n',
    cancer: 'n',
    medications: 'n',
    er_visit: 'n',
    chronic_illness: 'n', // Set chronic_illness to 'n' by default
  });



  const handleRadioChange = (e, question) => {
    const value = e.target.value;
    
    if (value === 'Yes') {
      // If there's only one insured, automatically select it
      if (insureds.length === 1) {
        const insuredId = insureds[0].id || insureds[0].name || `${insureds[0].firstName} ${insureds[0].lastName}`;
        setAnswers((prev) => ({
          ...prev,
          [question]: `yes(${insuredId})`,
        }));
      } else {
        // Multiple insureds, set to yes() without auto-selection
        setAnswers((prev) => ({
          ...prev,
          [question]: 'yes()',
        }));
      }
    } else {
      // "No" is selected
      setAnswers((prev) => ({
        ...prev,
        [question]: 'n',
      }));
    }
  };

  const handleCheckboxChange = (e, question, insuredId) => {
    const isChecked = e.target.checked;

    setAnswers((prev) => {
      const insuredList = prev[question].startsWith('yes(')
        ? prev[question].slice(4, -1).split(',').filter(Boolean) // Get insureds array from "yes(...)"
        : [];
      const updatedInsuredList = isChecked
        ? [...insuredList, insuredId]
        : insuredList.filter((id) => id !== insuredId);

      return {
        ...prev,
        [question]: updatedInsuredList.length > 0 ? `yes(${updatedInsuredList.join(',')})` : 'n',
      };
    });
  };

  const selectAllNo = () => {
    setAnswers({
      dui: 'n',
      arrested: 'n',
      heart_issues: 'n',
      high_blood_pressure: 'n',
      diabetes: 'n',
      anxiety_depression: 'n',
      cancer: 'n',
      medications: 'n',
      er_visit: 'n',
      chronic_illness: 'n',
    });
  };

  useEffect(() => {
    if (setMedicalAnswers) {
      setMedicalAnswers(answers);
    }
  }, [answers, setMedicalAnswers]);

  const questions = [
    { label: 'Has any proposed insured ever been convicted of a <strong>DWI</strong> or <strong>DUI</strong>?', key: 'dui' },
    { label: 'Has any applicant ever been <strong>arrested</strong>?', key: 'arrested' },
    { label: 'Has any proposed insured ever had or been treated for <strong>Angioplasty</strong>, <strong>Coronary Bypass</strong>, <strong>Heart Attack</strong>, <strong>Heart Failure</strong>, <strong>Angina</strong>, or <strong>Artery Disease</strong>?', key: 'heart_issues' },
    { label: 'Has any proposed insured ever been diagnosed as having or received treatment for <strong>high blood pressure</strong>?', key: 'high_blood_pressure' },
    { label: 'Has any proposed insured ever had or been treated for <strong>Diabetes</strong>?', key: 'diabetes' },
    { label: 'Has any proposed insured taken medications for <strong>Anxiety</strong> or <strong>Depression</strong>?', key: 'anxiety_depression' },
    { label: 'Has any proposed insured ever been diagnosed as having or received treatment for <strong>cancer, tumor or unexplained masses</strong>?', key: 'cancer' },
    { label: 'Are you currently taking or have you been prescribed <strong>medications by a doctor in the past five years</strong>?', key: 'medications' },
    { label: 'In the past 5 years, have you been <strong>hospitalized</strong> <strong>overnight</strong>?', key: 'er_visit' },
  ];

  const renderQuestion = (label, questionKey) => (
    <div className="question-group" key={questionKey}>
      <hr />
      <div className="question-row">
        <span className="question-label" dangerouslySetInnerHTML={{ __html: label }}></span>
        {questionKey !== 'chronic_illness' && (
          <div className="radio-group">
            <label>
              <input
                type="radio"
                name={questionKey}
                value="Yes"
                required
                checked={answers[questionKey].startsWith('yes')}
                onChange={(e) => handleRadioChange(e, questionKey)}
              />
              Yes
            </label>
            <label>
              <input
                type="radio"
                name={questionKey}
                value="No"
                required
                checked={answers[questionKey] === 'n'}
                onChange={(e) => handleRadioChange(e, questionKey)}
              />
              No
            </label>
          </div>
        )}
      </div>

      {answers[questionKey].startsWith('yes') && insureds.length > 0 && (
        <ul className="checkbox-list">
          {insureds.map((insured, index) => (
            <li key={insured.id || `${insured.firstName}-${insured.lastName}-${index}`} className="checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={answers[questionKey].includes(insured.id || insured.name || `${insured.firstName} ${insured.lastName}`)}
                  onChange={(e) => handleCheckboxChange(e, questionKey, insured.id || insured.name || `${insured.firstName} ${insured.lastName}`)}
                />
                {insured.name ? insured.name : `${insured.firstName} ${insured.lastName}`}
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div id="medicalQuestions" className="transition-section">
      <hr />
      <h4>
        Medical Questions
        <div className="no-to-all-container">
          <button className='insured-button' type="button" onClick={selectAllNo}>No to All</button>
        </div>
      </h4>
      <div className="questions_section">
        {questions.map((q) => renderQuestion(q.label, q.key))}
      </div>
    </div>
  );
};

export default MedicalQuestions;
