import React, { useState } from 'react';
import { FiStar, FiSearch, FiFilter } from 'react-icons/fi';
import Reports from './Reports';
import PotentialVIPs from '../vips/PotentialVIPs';
import FilterMenu from '../../common/FilterMenu';
import './RefReport.css';

const PotentialVIPsReport = ({ onBack }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Filter state
  const [selectedSA, setSelectedSA] = useState('All');
  const [selectedGA, setSelectedGA] = useState('All');
  const [selectedMGA, setSelectedMGA] = useState('All');
  const [selectedVipMonth, setSelectedVipMonth] = useState('All');
  const [selectedAtVip, setSelectedAtVip] = useState('All');
  const [selectedWithinReach, setSelectedWithinReach] = useState('All');

  // Available options supplied by child after data load
  const [saOptions, setSaOptions] = useState([]);
  const [gaOptions, setGaOptions] = useState([]);
  const [mgaOptions, setMgaOptions] = useState([]);

  // Report configuration
  const reportConfig = {
    title: 'Potential VIPs',
    description: 'Track agents approaching VIP status based on production',
    version: '1.0',
    category: 'Production',
    frequency: 'Daily'
  };

  const handleSearchChange = (e) => {
    const term = e.target.value;
    setSearchQuery(term);
    setIsSearching(term.trim().length > 0);
  };

  const handleFilterOptions = ({ saOptions: sa, gaOptions: ga, mgaOptions: mga }) => {
    setSaOptions(['All', ...sa.filter(Boolean)]);
    setGaOptions(['All', ...ga.filter(Boolean)]);
    setMgaOptions(['All', ...mga.filter(Boolean)]);
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

      {/* VIP Month Buttons */}
      <div className="filter-group" style={{ marginBottom: '12px' }}>
        <label className="filter-group-label" style={{ 
          fontWeight: '500', 
          marginBottom: '6px', 
          display: 'block', 
          color: 'var(--text-primary)',
          fontSize: '0.85rem'
        }}>
          VIP Month
        </label>
        <div className="filter-buttons-row" style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: '6px'
        }}>
          {['All', '1', '2', '3'].map(month => (
            <button
              key={`vip-month-${month}`}
              className={`filter-button ${selectedVipMonth === month ? 'active' : ''}`}
              style={{
                padding: '4px 8px',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                transition: 'all 0.2s ease',
                backgroundColor: selectedVipMonth === month ? 'var(--button-primary-bg)' : 'var(--sidebar-hover)',
                color: selectedVipMonth === month ? 'white' : 'var(--text-primary)',
                fontWeight: '400',
                minWidth: '60px'
              }}
              onClick={() => setSelectedVipMonth(month)}
            >
              {month === 'All' ? 'All' : `M${month}`}
            </button>
          ))}
        </div>
      </div>

      {/* At VIP Buttons */}
      <div className="filter-group" style={{ marginBottom: '12px' }}>
        <label className="filter-group-label" style={{ 
          fontWeight: '500', 
          marginBottom: '6px', 
          display: 'block', 
          color: 'var(--text-primary)',
          fontSize: '0.85rem'
        }}>
          At VIP
        </label>
        <div className="filter-buttons-row" style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: '6px'
        }}>
          {['All', 'Yes', 'No'].map(value => (
            <button
              key={`at-vip-${value}`}
              className={`filter-button ${selectedAtVip === value ? 'active' : ''}`}
              style={{
                padding: '4px 8px',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                transition: 'all 0.2s ease',
                backgroundColor: selectedAtVip === value ? 'var(--button-primary-bg)' : 'var(--sidebar-hover)',
                color: selectedAtVip === value ? 'white' : 'var(--text-primary)',
                fontWeight: '400',
                minWidth: '50px'
              }}
              onClick={() => setSelectedAtVip(value)}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      {/* Within Reach Buttons */}
      <div className="filter-group" style={{ marginBottom: '0' }}>
        <label className="filter-group-label" style={{ 
          fontWeight: '500', 
          marginBottom: '6px', 
          display: 'block', 
          color: 'var(--text-primary)',
          fontSize: '0.85rem'
        }}>
          Within Reach
        </label>
        <div className="filter-buttons-row" style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: '6px'
        }}>
          {['All', 'Yes', 'No'].map(value => (
            <button
              key={`within-reach-${value}`}
              className={`filter-button ${selectedWithinReach === value ? 'active' : ''}`}
              style={{
                padding: '4px 8px',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                transition: 'all 0.2s ease',
                backgroundColor: selectedWithinReach === value ? 'var(--button-primary-bg)' : 'var(--sidebar-hover)',
                color: selectedWithinReach === value ? 'white' : 'var(--text-primary)',
                fontWeight: '400',
                minWidth: '50px'
              }}
              onClick={() => setSelectedWithinReach(value)}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
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
            setSelectedVipMonth('All');
            setSelectedAtVip('All');
            setSelectedWithinReach('All');
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
      title="Potential VIPs"
      description="Track agents approaching VIP status based on production"
      actions={[searchFilterAction]}
      fullScreenCapable={true}
    >
      <PotentialVIPs 
        searchQuery={searchQuery}
        filters={{
          sa: selectedSA,
          ga: selectedGA,
          mga: selectedMGA,
          vipMonth: selectedVipMonth,
          atVip: selectedAtVip,
          withinReach: selectedWithinReach
        }}
        onFilterOptions={handleFilterOptions}
      />
    </Reports>
  );
};

export default PotentialVIPsReport;

