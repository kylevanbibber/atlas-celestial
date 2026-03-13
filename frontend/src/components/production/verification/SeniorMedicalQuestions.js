import React, { useState, useEffect } from 'react';

const SeniorMedicalQuestions = ({ insureds, setSeniorMedicalAnswers }) => {
  const [answers, setAnswers] = useState({
    senior_rejected: 'n',
    heart_lung: 'n',
    cirrhosis: 'n',
    amputation: 'n',
    cancer_senior: 'n',
    oxygen: 'n',
  });

  useEffect(() => {
    setSeniorMedicalAnswers(answers);
  }, [answers, setSeniorMedicalAnswers]);

  const handleRadioChange = (e, question) => {
    const value = e.target.value;
    
    if (value === 'Yes') {
      // If there's only one insured, automatically select it
      if (insureds.length === 1) {
        const insuredName = insureds[0].name;
        setAnswers((prev) => ({
          ...prev,
          [question]: `yes(${insuredName})`,
        }));
      } else {
        // Multiple insureds, set to yes without auto-selection
        setAnswers((prev) => ({
          ...prev,
          [question]: 'yes',
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

  const handleCheckboxChange = (e, question, insuredName) => {
    const isChecked = e.target.checked;
    setAnswers((prev) => {
      const currentAnswer = prev[question];
      const currentInsureds = currentAnswer.startsWith('yes(') ? currentAnswer.slice(4, -1).split(', ') : [];

      const updatedInsureds = isChecked
        ? [...currentInsureds, insuredName]
        : currentInsureds.filter((name) => name !== insuredName);

      const newAnswer = updatedInsureds.length > 0 ? `yes(${updatedInsureds.join(', ')})` : 'yes';

      return {
        ...prev,
        [question]: newAnswer,
      };
    });
  };

  const selectAllNo = () => {
    setAnswers({
      senior_rejected: 'n',
      heart_lung: 'n',
      cirrhosis: 'n',
      amputation: 'n',
      cancer_senior: 'n',
      oxygen: 'n',
    });
  };

  const questions = [
    { label: 'Has any proposed insured ever been <strong>rejected for insurance by American Income Life</strong>?', key: 'senior_rejected' },
    { label: 'Has any proposed insured been advised to have or had a <strong>heart</strong>, lung, liver or bone marrow transplant?', key: 'heart_lung' },
    { label: 'Has any proposed insured been diagnosed or <u>treated</u> for <strong>cirrhosis, Alzheimer\'s disease, ALS, or dementia</strong>?', key: 'cirrhosis' },
    { label: 'Has any proposed insured had a <strong>toe, foot, or leg amputated</strong> due to illness or disease?', key: 'amputation' },
    { label: 'In the past 2 years, has the proposed insured been <strong>hospitalized for heart attack or stroke</strong> or been diagnosed or received treatment for <strong>cancer</strong>?', key: 'cancer_senior' },
    { label: 'Do you use <strong>oxygen</strong> to assist in breathing in an in-home setting?', key: 'oxygen' }
  ];

  const renderQuestion = (label, questionKey) => (
    <div className="question-group" key={questionKey}>
      <hr />
      <div className="question-row">
        <span className="question-label" dangerouslySetInnerHTML={{ __html: label }}></span>
        <div className="radio-group">
          <label>
            <input
              type="radio"
              name={questionKey}
              value="Yes"
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
              checked={answers[questionKey] === 'n'}
              onChange={(e) => handleRadioChange(e, questionKey)}
            />
            No
          </label>
        </div>
      </div>

      {answers[questionKey].startsWith('yes') && insureds.length > 0 && (
        <ul className="checkbox-list">
          {insureds.map((insured, index) => (
            <li key={index} className="checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={answers[questionKey].includes(insured.name)}
                  onChange={(e) => handleCheckboxChange(e, questionKey, insured.name)}
                />
                {insured.name}
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div id="seniorMedicalQuestions" className="transition-section">
      <h4>Senior Medical Questions</h4>
      <div className="no-to-all-container">
        <button type="button" className="insured-button" onClick={selectAllNo}>
          No to All
        </button>
      </div>
      <div className="questions_section">
        {questions.map((q) => renderQuestion(q.label, q.key))}
      </div>
    </div>
  );
};

export default SeniorMedicalQuestions;
