// Main Reports base component
export { default as Reports } from './Reports';

// Individual Report Components
export { default as RefReport } from './RefReport';

// Report Registry - add new reports here
export const reportRegistry = {
  'ref-report': {
    id: 'ref-report',
    title: 'REF Report',
    description: 'Recruitment and referral tracking dashboard',
    component: 'RefReport',
    category: 'Referrals',
    icon: 'FiUsers',
    frequency: 'Weekly',
    tags: ['referrals', 'recruitment', 'tracking'],
    isActive: true,
    version: '1.0'
  }
  // Add more reports here as they are created
  // 'sales-report': {
  //   id: 'sales-report',
  //   title: 'Sales Report',
  //   description: 'Sales performance and metrics',
  //   component: 'SalesReport',
  //   category: 'Sales',
  //   icon: 'FiDollarSign',
  //   frequency: 'Daily',
  //   tags: ['sales', 'performance', 'metrics'],
  //   isActive: true,
  //   version: '1.0'
  // }
};

// Helper function to get all active reports
export const getActiveReports = () => {
  return Object.values(reportRegistry).filter(report => report.isActive);
};

// Helper function to get report by ID
export const getReportById = (id) => {
  return reportRegistry[id] || null;
}; 