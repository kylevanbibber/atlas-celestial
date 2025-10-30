import React, { useState } from 'react';
import Tabs from '../utils/Tabs';
import CodePackTab from './leads/CodePackTab';
import ReleasePackTab from './leads/ReleasePackTab';
import AllotmentTab from './leads/AllotmentTab';

const LeadsUtilities = () => {
  const [activeTab, setActiveTab] = useState('codepack');

  const tabs = [
    { key: 'codepack', label: 'Code Pack' },
    { key: 'releasepack', label: 'Release Pack' },
    { key: 'allotment', label: 'Allotment' },
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
      </Tabs>
    </div>
  );
};

export default LeadsUtilities;


