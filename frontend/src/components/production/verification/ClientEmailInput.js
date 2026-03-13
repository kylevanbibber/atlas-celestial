import React, { useState, useRef, useEffect } from 'react';
import './ClientEmailInput.css';

const ClientEmailInput = ({ emailHandle, emailWebsite, emailDomain, setClientEmail }) => {
  const [handle, setHandle] = useState(emailHandle || '');
  const [website, setWebsite] = useState(emailWebsite || '');
  const [domain, setDomain] = useState(emailDomain || 'com');
  const [hint, setHint] = useState('');

  const emailProviders = ['gmail', 'yahoo', 'outlook', 'hotmail', 'icloud', 'aol'];
  const domainExtensions = ['com', 'net', 'org', 'gov', 'edu'];

  // Reference to a hidden span to calculate the width of the input text
  const hiddenSpanRef = useRef(null);

  // Update parent state when email inputs change
  useEffect(() => {
    setClientEmail({
      handle: handle,
      website: website,
      domain: domain,
    });
  }, [handle, website, domain, setClientEmail]);

  // Handle changes in email handle input
  const handleEmailHandleChange = (e) => {
    const value = e.target.value.replace(/@/g, ''); // Remove '@' if present
    setHandle(value);
  };

  const handleEmailWebsiteChange = (e) => {
    // Allow alphanumeric characters and dots (.) in the website portion
    const value = e.target.value.replace(/[^a-zA-Z0-9.]/g, ''); 
    setWebsite(value);
  
    // Find the first matching suggestion for inline autocomplete
    const suggestion = emailProviders.find((provider) =>
      provider.toLowerCase().startsWith(value.toLowerCase())
    );
    setHint(suggestion ? suggestion : '');
  };

  // Handle domain extension selection
  const handleDomainChange = (e) => {
    setDomain(e.target.value);
  };

  // Handle Tab press to accept the suggestion
  const handleKeyDown = (e) => {
    if (e.key === 'Tab' && hint) {
      e.preventDefault(); // Prevent default Tab behavior
      setWebsite(hint); // Set the email website to the hint value
      setHint(''); // Clear the hint
    }
  };

  // Function to calculate the width of the input text
  const getInputTextWidth = () => {
    if (hiddenSpanRef.current) {
      hiddenSpanRef.current.textContent = website;
      return hiddenSpanRef.current.offsetWidth;
    }
    return 0;
  };

  return (
    <div className="input-group">
      <label htmlFor="client_email">Client Email on App</label>
      <div className="client-email-container">
        {/* Input for the email handle */}
        <input
          type="text"
          id="email_handle"
          name="email_handle"
          value={handle}
          onChange={handleEmailHandleChange}
          required
          className="email-handle-input"
          autoComplete="off"
        />

        <span className="email-at-symbol">@</span>

        {/* Input for the email website with text hint */}
        <div className="email-website-container">
          <input
            type="text"
            id="email_website"
            name="email_website"
            value={website}
            onChange={handleEmailWebsiteChange}
            onKeyDown={handleKeyDown}
            required
            autoComplete="off"
            className="email-website-input"
            style={{
              paddingRight: hint ? `${getInputTextWidth() + 9}px` : '0px', // Padding to make space for the hint
            }}
          />

          {/* Text hint (displayed in a lighter color to simulate a placeholder) */}
          {hint && (
            <span
              className="email-hint"
              style={{
                left: `${getInputTextWidth() + 5}px`, // Position based on input text width
              }}
            >
              {hint.substring(website.length)}
            </span>
          )}
        </div>

        {/* Dropdown for email domain extensions */}
        <select
          id="email_domain"
          name="email_domain"
          value={domain}
          onChange={handleDomainChange}
          required
          className="email-domain-select"
        >
          {domainExtensions.map((extension, index) => (
            <option key={index} value={extension}>
              .{extension}
            </option>
          ))}
        </select>
      </div>

      {/* Hidden span used to calculate text width */}
      <span ref={hiddenSpanRef} className="email-hidden-span"></span>
    </div>
  );
};

export default ClientEmailInput; 