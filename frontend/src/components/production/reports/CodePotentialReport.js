import React, { useState } from 'react';
import { FiTarget, FiSearch, FiFilter } from 'react-icons/fi';
import Reports from './Reports';
import CodePotential from '../vips/CodePotential';
import FilterMenu from '../../common/FilterMenu';
import './RefReport.css';

const CodePotentialReport = ({ onBack }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Filter state
  const [selectedSA, setSelectedSA] = useState('All');
  const [selectedGA, setSelectedGA] = useState('All');
  const [selectedMGA, setSelectedMGA] = useState('All');
  const [selectedRGA, setSelectedRGA] = useState('All');

  // Available options supplied by child after data load
  const [saOptions, setSaOptions] = useState([]);
  const [gaOptions, setGaOptions] = useState([]);
  const [mgaOptions, setMgaOptions] = useState([]);
  const [rgaOptions, setRgaOptions] = useState([]);

  // Report configuration
  const reportConfig = {
    title: 'Code Potential',
    description: 'Identify agents with coding potential and track progress',
    version: '1.0',
    category: 'Production',
    frequency: 'Daily'
  };

  const handleSearchChange = (e) => {
    const term = e.target.value;
    setSearchQuery(term);
    setIsSearching(term.trim().length > 0);
  };

  const handleFilterOptions = ({ saOptions: sa, gaOptions: ga, mgaOptions: mga, rgaOptions: rga }) => {
    if (sa) setSaOptions(['All', ...sa.filter(Boolean)]);
    if (ga) setGaOptions(['All', ...ga.filter(Boolean)]);
    if (mga) setMgaOptions(['All', ...mga.filter(Boolean)]);
    if (rga) setRgaOptions(['All', ...rga.filter(Boolean)]);
  };

  const filterMenuContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '280px', maxWidth: '320px' }}>
      {/* MGA Dropdown */}
      <div className="filter-group" style={{ marginBottom: '12px' }}>
        <label className="filter-group-label" style={{ 
          fontWeight: '500', 
          marginBottom: '6px', 
          display: 'block', 
          color: 'var(--text-primary)',
          fontSize: '0.85rem'
        }}>
          MGA
        </label>
        <select 
          value={selectedMGA} 
          onChange={(e) => setSelectedMGA(e.target.value)}
          style={{
            width: '100%',
            padding: '6px 8px',
            borderRadius: '4px',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--input-bg)',
            color: 'var(--text-primary)',
            fontSize: '0.85rem'
          }}
        >
          {mgaOptions.map(opt => (
            <option key={`mga-${opt}`} value={opt}>{opt}</option>
          ))}
        </select>
      </div>

      {/* GA Dropdown */}
      <div className="filter-group" style={{ marginBottom: '12px' }}>
        <label className="filter-group-label" style={{ 
          fontWeight: '500', 
          marginBottom: '6px', 
          display: 'block', 
          color: 'var(--text-primary)',
          fontSize: '0.85rem'
        }}>
          GA
        </label>
        <select 
          value={selectedGA} 
          onChange={(e) => setSelectedGA(e.target.value)}
          style={{
            width: '100%',
            padding: '6px 8px',
            borderRadius: '4px',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--input-bg)',
            color: 'var(--text-primary)',
            fontSize: '0.85rem'
          }}
        >
          {gaOptions.map(opt => (
            <option key={`ga-${opt}`} value={opt}>{opt}</option>
          ))}
        </select>
      </div>

      {/* SA Dropdown */}
      <div className="filter-group" style={{ marginBottom: '12px' }}>
        <label className="filter-group-label" style={{ 
          fontWeight: '500', 
          marginBottom: '6px', 
          display: 'block', 
          color: 'var(--text-primary)',
          fontSize: '0.85rem'
        }}>
          SA
        </label>
        <select 
          value={selectedSA} 
          onChange={(e) => setSelectedSA(e.target.value)}
          style={{
            width: '100%',
            padding: '6px 8px',
            borderRadius: '4px',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--input-bg)',
            color: 'var(--text-primary)',
            fontSize: '0.85rem'
          }}
        >
          {saOptions.map(opt => (
            <option key={`sa-${opt}`} value={opt}>{opt}</option>
          ))}
        </select>
      </div>

      {/* RGA Dropdown - only show if we have RGA options */}
      {rgaOptions.length > 1 && (
        <div className="filter-group" style={{ marginBottom: '0' }}>
          <label className="filter-group-label" style={{ 
            fontWeight: '500', 
            marginBottom: '6px', 
            display: 'block', 
            color: 'var(--text-primary)',
            fontSize: '0.85rem'
          }}>
            RGA
          </label>
          <select 
            value={selectedRGA} 
            onChange={(e) => setSelectedRGA(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 8px',
              borderRadius: '4px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--input-bg)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem'
            }}
          >
            {rgaOptions.map(opt => (
              <option key={`rga-${opt}`} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );

  // Custom action for search and filter
  const searchFilterAction = {
    component: (
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        {/* Search */}
        <div className="search-box" style={{ minWidth: '300px' }}>
          <div className="search-input-wrapper">
            <FiSearch className={`search-icon ${isSearching ? 'searching' : ''}`} />
            <input
              type="text"
              placeholder="Search by agent or manager..."
              value={searchQuery}
              onChange={handleSearchChange}
              className={`search-input ${isSearching ? 'searching' : ''}`}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--input-bg)',
                color: 'var(--text-primary)',
                fontSize: '0.9rem'
              }}
            />
          </div>
        </div>

        {/* Filter Menu */}
        <FilterMenu 
          activeFilters={{}}
          onFilterToggle={() => {}}
          onStatusFilterToggle={() => {}}
          onToggleAllRoles={() => {}}
          onResetFilters={() => {
            setSelectedSA('All');
            setSelectedGA('All');
            setSelectedMGA('All');
            setSelectedRGA('All');
          }}
          menuType="expandable"
          buttonLabel={<FiFilter title="Filter Results" />}
          position="bottom-right"
          customContent={filterMenuContent}
          customContentOnly={true}
        />
      </div>
    )
  };

  return (
    <Reports
      reportConfig={reportConfig}
      onBack={onBack}
      showBackButton={true}
      title="Code Potential"
      description="Identify agents with coding potential and track progress"
      actions={[searchFilterAction]}
      fullScreenCapable={true}
    >
      <CodePotential 
        searchQuery={searchQuery}
        filters={{
          sa: selectedSA,
          ga: selectedGA,
          mga: selectedMGA,
          rga: selectedRGA
        }}
        onFilterOptions={handleFilterOptions}
      />
    </Reports>
  );
};

export default CodePotentialReport;

