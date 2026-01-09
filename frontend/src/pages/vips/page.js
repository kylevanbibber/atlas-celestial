import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import PotentialVIPs from '../../components/production/vips/PotentialVIPs';
import PendingUsers from '../../components/production/vips/PendingUsers';
import Codes from '../../components/production/vips/Codes';
import SAGACodes from '../../components/production/vips/SAGACodes';
import CodePotential from '../../components/production/vips/CodePotential';
import { FiSearch, FiFilter } from 'react-icons/fi';
import FilterMenu from '../../components/common/FilterMenu';
import '../../components/production/ProductionReports.css';
import '../../components/utilities/notification/NotificationSchedule.css';
import './VIPs.css';

const VIPsPage = () => {
  const { user, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState('potential');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Filter state
  const [selectedSA, setSelectedSA] = useState('All');
  const [selectedGA, setSelectedGA] = useState('All');
  const [selectedMGA, setSelectedMGA] = useState('All');
  const [selectedRGA, setSelectedRGA] = useState('All');
  const [selectedVipMonth, setSelectedVipMonth] = useState('All'); // 'All' | '1' | '2' | '3'
  const [selectedAtVip, setSelectedAtVip] = useState('All'); // 'All' | 'Yes' | 'No'
  const [selectedWithinReach, setSelectedWithinReach] = useState('All'); // 'All' | 'Yes' | 'No'

  // Available options supplied by child after data load
  const [saOptions, setSaOptions] = useState([]);
  const [gaOptions, setGaOptions] = useState([]);
  const [mgaOptions, setMgaOptions] = useState([]);
  const [rgaOptions, setRgaOptions] = useState([]);

  // VIPs is accessible to all production users; data visibility is filtered in PotentialVIPs

  const tabs = [
    {
      id: 'potential',
      name: 'Potential VIPs'
    },
    {
      id: 'pending',
      name: 'Pending'
    },
    {
      id: 'codes',
      name: 'Codes'
    },
    {
      id: 'sagacodes',
      name: 'SAGA Codes'
    },
    {
      id: 'codepotential',
      name: 'Code Potential'
    }
    // Future tabs can be added here
  ];

  const handleSearchChange = (e) => {
    const term = e.target.value;
    setSearchQuery(term);
    setIsSearching(term.trim().length > 0);
  };

  const handleFilterOptions = ({ saOptions: sa, gaOptions: ga, mgaOptions: mga, rgaOptions: rga }) => {
    setSaOptions(['All', ...sa.filter(Boolean)]);
    setGaOptions(['All', ...ga.filter(Boolean)]);
    setMgaOptions(['All', ...mga.filter(Boolean)]);
    if (rga) {
      setRgaOptions(['All', ...rga.filter(Boolean)]);
    }
  };

  // Filter categories for FilterMenu
  const filterCategories = [
    {
      name: 'MGA',
      type: 'dropdown',
      options: mgaOptions,
      value: selectedMGA,
      onChange: setSelectedMGA
    },
    {
      name: 'GA', 
      type: 'dropdown',
      options: gaOptions,
      value: selectedGA,
      onChange: setSelectedGA
    },
    {
      name: 'SA',
      type: 'dropdown', 
      options: saOptions,
      value: selectedSA,
      onChange: setSelectedSA
    },
    {
      name: 'VIP Month',
      type: 'buttons',
      filters: ['All', '1', '2', '3'],
      onToggle: (value) => setSelectedVipMonth(value),
      getFilterLabel: (filter) => filter === 'All' ? 'All Months' : `Month ${filter}`
    },
    {
      name: 'At VIP',
      type: 'buttons',
      filters: ['All', 'Yes', 'No'],
      onToggle: (value) => setSelectedAtVip(value),
      getFilterLabel: (filter) => filter
    },
    {
      name: 'Within Reach',
      type: 'buttons',
      filters: ['All', 'Yes', 'No'],
      onToggle: (value) => setSelectedWithinReach(value),
      getFilterLabel: (filter) => filter
    }
  ];

  // Create activeFilters object for FilterMenu
  const activeFilters = {
    // For button filters, set true for selected value
    'All': selectedVipMonth === 'All',
    '1': selectedVipMonth === '1',
    '2': selectedVipMonth === '2', 
    '3': selectedVipMonth === '3',
    'Yes': selectedAtVip === 'Yes' || selectedWithinReach === 'Yes',
    'No': selectedAtVip === 'No' || selectedWithinReach === 'No'
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

      {/* RGA Dropdown - only show if we have RGA options (codes tab) */}
      {rgaOptions.length > 1 && (
        <div className="filter-group" style={{ marginBottom: '12px' }}>
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

  return (
    <>
      {/* Search + FilterMenu Row */}
      <div className="search-filter-row">
        {/* Search */}
        <div className="search-box">
          <div className="search-input-wrapper">
            <FiSearch className={`search-icon ${isSearching ? 'searching' : ''}`} />
            <input
              type="text"
              placeholder="Search by agent or manager..."
              value={searchQuery}
              onChange={handleSearchChange}
              className={`search-input ${isSearching ? 'searching' : ''}`}
            />
            {isSearching && (
              <div className="search-status">
                Searching...
              </div>
            )}
          </div>
        </div>

        {/* Filter Menu */}
        <div>
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
      </div>

      {/* Tabs */}
      <div className="vips-tabs-container">
        <div className="vips-tabs-border">
          <nav className="vips-tabs-nav">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`vips-tab-button ${
                  activeTab === tab.id ? 'active' : 'inactive'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="vips-tab-content">
        {activeTab === 'potential' && (
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
        )}
        {activeTab === 'pending' && (
          <PendingUsers 
            searchQuery={searchQuery}
            filters={{
              sa: selectedSA,
              ga: selectedGA,
              mga: selectedMGA
            }}
            onFilterOptions={handleFilterOptions}
          />
        )}
        {activeTab === 'codes' && (
          <Codes 
            searchQuery={searchQuery}
            filters={{
              sa: selectedSA,
              ga: selectedGA,
              mga: selectedMGA,
              rga: selectedRGA
            }}
            onFilterOptions={handleFilterOptions}
          />
        )}
        {activeTab === 'sagacodes' && (
          <SAGACodes 
            searchQuery={searchQuery}
            filters={{
              sa: selectedSA,
              ga: selectedGA,
              mga: selectedMGA,
              rga: selectedRGA
            }}
            onFilterOptions={handleFilterOptions}
          />
        )}
        {activeTab === 'codepotential' && (
          <CodePotential 
            searchQuery={searchQuery}
            filters={{
              sa: selectedSA,
              ga: selectedGA,
              mga: selectedMGA,
              rga: selectedRGA
            }}
          />
        )}
        {/* Future tab components can be added here and receive searchQuery similarly */}
      </div>
    </>
  );
};

export default VIPsPage; 