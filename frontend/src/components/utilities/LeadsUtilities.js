import React, { useState } from 'react';
import Tabs from '../utils/Tabs';
import CodePackTab from './leads/CodePackTab';
import ReleasePackTab from './leads/ReleasePackTab';
import AllotmentTab from './leads/AllotmentTab';
import LeadPackInfoTab from './leads/LeadPackInfoTab';

const LeadsUtilities = () => {
  const [activeTab, setActiveTab] = useState('codepack');

  const tabs = [
    { key: 'codepack', label: 'Code Pack' },
    { key: 'releasepack', label: 'Release Pack' },
    { key: 'allotment', label: 'Allotment' },
    { key: 'leadpackinfo', label: 'Lead Pack Info' },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Leads</h2>
      <Tabs 
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        styleSet="modern"
      >
        {activeTab === 'codepack' && (
          <CodePackTab />
        )}
        {activeTab === 'releasepack' && (
          <ReleasePackTab />
        )}
        {activeTab === 'allotment' && (
          <AllotmentTab />
        )}
        {activeTab === 'leadpackinfo' && (
          <LeadPackInfoTab />
        )}
      </Tabs>
    </div>
  );
};

export default LeadsUtilities;


