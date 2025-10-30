import React from 'react';
import { useNavigate } from 'react-router-dom';
import './RecruitmentSuccess.css';

const RecruitmentSuccess = () => {
  const navigate = useNavigate();
  
  return (
    <div className="recruitment-success-page">
      {/* Header */}
      <div className="recruitment-header">
        <div className="recruitment-header-content">
          <img 
            src="/assets/Globe_AIL_Arias.png" 
            alt="Globe Life American Income Division" 
            height="75px"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        </div>
        <div className="recruitment-header-content"></div>
      </div>
      
      <div className="recruitment-success-container">
        <div className="recruitment-success-card">
          <div className="recruitment-success-icon">
            <svg 
              width="100" 
              height="100" 
              viewBox="0 0 100 100" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="50" cy="50" r="50" fill="#319B42"/>
              <path 
                d="M30 50L45 65L70 35" 
                stroke="white" 
                strokeWidth="8" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>
          </div>
          
          <h1>Thank You!</h1>
          <h2>Your Application Has Been Successfully Submitted</h2>
          
          <p className="recruitment-success-message">
            We appreciate your interest in joining our team at Globe Life American Income Division - Arias Organization.
          </p>
          
          <p className="recruitment-success-details">
            Your compatibility assessment has been received and is being reviewed by our hiring team. 
            If your qualifications match our current opportunities, a member of our team will contact you 
            within 3-5 business days to schedule an interview.
          </p>
          
          <div className="recruitment-next-steps">
            <h3>What Happens Next?</h3>
            <ul>
              <li>Our hiring team will review your application</li>
              <li>Qualified candidates will be contacted for an interview</li>
              <li>You will receive updates via the email you provided</li>
            </ul>
          </div>
          
          <div className="recruitment-contact-info">
            <p>If you have any questions, please don't hesitate to reach out to your hiring manager.</p>
          </div>
          
          <button 
            className="recruitment-btn-primary" 
            onClick={() => navigate('/')}
          >
            Return to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecruitmentSuccess;

