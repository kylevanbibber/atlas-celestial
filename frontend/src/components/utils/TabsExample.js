import React, { useState } from 'react';
import Tabs from './Tabs';

const TabsExample = () => {
  const [activeTab, setActiveTab] = useState('tab1');

  // Example tabs configuration
  const exampleTabs = [
    {
      key: 'tab1',
      label: 'Dashboard',
      icon: '📊',
      badge: 3
    },
    {
      key: 'tab2',
      label: 'Settings',
      icon: '⚙️'
    },
    {
      key: 'tab3',
      label: 'Reports',
      icon: '📈',
      badge: 12
    },
    {
      key: 'tab4',
      label: 'Disabled',
      icon: '🚫',
      disabled: true
    }
  ];

  return (
    <div style={{ padding: '20px' }}>
      <h2>Tabs Component Examples</h2>
      
      <div style={{ marginBottom: '40px' }}>
        <h3>Default Style</h3>
        <Tabs
          tabs={exampleTabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          styleSet="default"
        >
          {activeTab === 'tab1' && (
            <div>
              <h4>Dashboard Content</h4>
              <p>This is the dashboard content with default styling.</p>
            </div>
          )}
          {activeTab === 'tab2' && (
            <div>
              <h4>Settings Content</h4>
              <p>This is the settings content.</p>
            </div>
          )}
          {activeTab === 'tab3' && (
            <div>
              <h4>Reports Content</h4>
              <p>This is the reports content.</p>
            </div>
          )}
        </Tabs>
      </div>

      <div style={{ marginBottom: '40px' }}>
        <h3>Modern Style</h3>
        <Tabs
          tabs={exampleTabs}
          defaultActiveTab="tab1"
          styleSet="modern"
        >
          <div>
            <h4>Modern Style Content</h4>
            <p>This shows the modern tab styling.</p>
          </div>
        </Tabs>
      </div>

      <div style={{ marginBottom: '40px' }}>
        <h3>Minimal Style</h3>
        <Tabs
          tabs={exampleTabs}
          defaultActiveTab="tab1"
          styleSet="minimal"
        >
          <div>
            <h4>Minimal Style Content</h4>
            <p>This shows the minimal tab styling.</p>
          </div>
        </Tabs>
      </div>

      <div style={{ marginBottom: '40px' }}>
        <h3>Pills Style</h3>
        <Tabs
          tabs={exampleTabs}
          defaultActiveTab="tab1"
          styleSet="pills"
        >
          <div>
            <h4>Pills Style Content</h4>
            <p>This shows the pills tab styling.</p>
          </div>
        </Tabs>
      </div>
    </div>
  );
};

export default TabsExample; 