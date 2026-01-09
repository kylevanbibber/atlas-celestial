// Main Reports base component
export { default as Reports } from './Reports';

// Individual Report Components
export { default as RefReport } from './RefReport';
export { default as PotentialVIPsReport } from './PotentialVIPsReport';
export { default as PendingUsersReport } from './PendingUsersReport';
export { default as CodesReport } from './CodesReport';
export { default as SAGACodesReport } from './SAGACodesReport';
export { default as CodePotentialReport } from './CodePotentialReport';

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
  },
  'potential-vips': {
    id: 'potential-vips',
    title: 'Potential VIPs',
    description: 'Track agents approaching VIP status based on production',
    component: 'PotentialVIPsReport',
    category: 'Production',
    icon: 'FiStar',
    frequency: 'Daily',
    tags: ['vips', 'production', 'tracking'],
    isActive: true,
    version: '1.0'
  },
  'pending-users': {
    id: 'pending-users',
    title: 'Pending Users',
    description: 'Monitor agents pending activation and onboarding status',
    component: 'PendingUsersReport',
    category: 'Production',
    icon: 'FiClock',
    frequency: 'Daily',
    tags: ['pending', 'onboarding', 'tracking'],
    isActive: true,
    version: '1.0'
  },
  'codes': {
    id: 'codes',
    title: 'Codes',
    description: 'Track agent code assignments and processing time',
    component: 'CodesReport',
    category: 'Production',
    icon: 'FiFileText',
    frequency: 'Daily',
    tags: ['codes', 'production', 'tracking'],
    isActive: true,
    version: '1.0'
  },
  'saga-codes': {
    id: 'saga-codes',
    title: 'SAGA Codes',
    description: 'Track SA and GA level code assignments and metrics',
    component: 'SAGACodesReport',
    category: 'Production',
    icon: 'FiAward',
    frequency: 'Daily',
    tags: ['saga', 'codes', 'tracking'],
    isActive: true,
    version: '1.0'
  },
  'code-potential': {
    id: 'code-potential',
    title: 'Code Potential',
    description: 'Identify agents with coding potential and track progress',
    component: 'CodePotentialReport',
    category: 'Production',
    icon: 'FiTarget',
    frequency: 'Daily',
    tags: ['potential', 'codes', 'tracking'],
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