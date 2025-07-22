import React, { useState } from 'react';
import { FiList, FiGitPullRequest } from 'react-icons/fi';
import AdminHierarchySettings from '../admin/AdminHierarchySettings';
import AdminHierarchyTableView from '../admin/AdminHierarchyTableView';
import './HierarchyViewSelector.css';

const HierarchyViewSelector = () => {
  const [viewMode, setViewMode] = useState('tree');

  return (
    <div className="settings-section">

      
      {viewMode === 'tree' ? (
        <AdminHierarchySettings />
      ) : (
        <AdminHierarchyTableView />
      )}
    </div>
  );
};

export default HierarchyViewSelector; 