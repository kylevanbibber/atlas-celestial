import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import api from '../../../api';
import DataTable from '../../utils/DataTable';

const PotentialVIPs = () => {
  const { user } = useAuth();
  const [potentialVIPs, setPotentialVIPs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPotentialVIPs();
  }, []);

  const fetchPotentialVIPs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get('/admin/potential-vips');
      
      if (response.data.success) {
        setPotentialVIPs(response.data.data || []);
      } else {
        setError('Failed to fetch potential VIPs data');
      }
    } catch (err) {
      console.error('Error fetching potential VIPs:', err);
      setError('Error loading potential VIPs data');
    } finally {
      setLoading(false);
    }
    console.log(potentialVIPs);
  };

  const columns = useMemo(() => [
    {
      Header: 'Agent Name',
      accessor: 'lagnname',
      Cell: ({ value }) => (
        <span className="font-medium text-gray-900">{value}</span>
      )
    },
    {
      Header: 'Start Date',
      accessor: 'esid',
      Cell: ({ value }) => {
        if (!value) return '-';
        // Avoid timezone shifts: esid is a DATE (yyyy-mm-dd). Render as-is.
        return String(value);
      }
    },
    {
      Header: 'VIP Status',
      accessor: 'vipEligibleMonth',
      Cell: ({ value }) => (
        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
          VIP Month {value}/3
        </span>
      )
    },
    {
      Header: 'Total LVL_1_GROSS',
      accessor: 'totalLvl1Gross',
      Cell: ({ value }) => (
        <span className="font-medium text-gray-900">
          ${value || '0.00'}
        </span>
      )
    },
    {
      Header: 'Latest Report',
      accessor: 'latestReportDate',
      Cell: ({ value }) => value || 'No reports'
    },
    {
      Header: 'SA',
      accessor: 'sa',
      Cell: ({ value }) => value || '-'
    },
    {
      Header: 'GA',
      accessor: 'ga',
      Cell: ({ value }) => value || '-'
    },
    {
      Header: 'MGA',
      accessor: 'mga',
      Cell: ({ value }) => value || '-'
    }
  ], []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading potential VIPs...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
            <div className="mt-4">
              <button
                onClick={fetchPotentialVIPs}
                className="bg-red-100 px-3 py-2 rounded-md text-sm font-medium text-red-800 hover:bg-red-200"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Potential VIPs
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Agents currently in their VIP eligibility window (months 2-4 after start date)
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Note: Agents are VIP eligible for exactly 3 months after their first month
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">
                Total: {potentialVIPs.length} potential VIPs
              </span>
              <button
                onClick={fetchPotentialVIPs}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md text-sm font-medium"
              >
                Refresh
              </button>
            </div>
          </div>

          <DataTable
            columns={columns}
            data={potentialVIPs}
            initialPageSize={25}
            searchPlaceholder="Search potential VIPs..."
          />
        </div>
      </div>
    </div>
  );
};

export default PotentialVIPs; 