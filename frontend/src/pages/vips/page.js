import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import PotentialVIPs from '../../components/production/vips/PotentialVIPs';

const VIPsPage = () => {
  const { user, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState('potential');

  // Check if user has app team role
  const isAppTeam = user?.teamRole === 'app';

  if (!isAppTeam) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="mt-2 text-sm font-medium text-gray-900">Access Denied</h3>
            <p className="mt-1 text-sm text-gray-500">
              This page is only accessible to app team members.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const tabs = [
    {
      id: 'potential',
      name: 'Potential VIPs',
      description: 'Agents in their 2nd to 4th month'
    }
    // Future tabs can be added here
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">VIPs Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage and track VIP agents and potential VIP candidates
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}
                >
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>
          
          {/* Tab descriptions */}
          {tabs.map((tab) => (
            activeTab === tab.id && (
              <div key={tab.id} className="mt-2">
                <p className="text-sm text-gray-600">{tab.description}</p>
              </div>
            )
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'potential' && (
            <PotentialVIPs />
          )}
          
          {/* Future tab components can be added here */}
        </div>
      </div>
    </div>
  );
};

export default VIPsPage; 