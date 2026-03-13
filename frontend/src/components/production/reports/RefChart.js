import React from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';

const RefChart = ({ 
  data = [], 
  loading = false, 
  error = null,
  height = 300,
  showLegend = true 
}) => {
  
  // Ensure data is always an array
  const chartData = Array.isArray(data) ? data : [];
  
  // Custom tooltip to format the data nicely
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const date = new Date(label).toLocaleDateString();
      return (
        <div className="chart-tooltip" style={{
          background: 'white',
          border: '1px solid #ccc',
          borderRadius: '4px',
          padding: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          minWidth: '200px'
        }}>
          <p style={{ margin: '0 0 6px 0', fontWeight: 'bold', fontSize: '14px' }}>{date}</p>
          {payload.map((entry, index) => {
            // Determine if this is a user/team specific line
            const isUserLine = entry.dataKey === 'user_true_refs';
            const isTeamLine = entry.dataKey === 'team_true_refs';
            const value = entry.value || 0;
            
            return (
              <p key={index} style={{ 
                margin: '3px 0', 
                color: entry.color,
                fontSize: '13px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ marginRight: '12px' }}>{entry.name}:</span>
                <span style={{ fontWeight: 'bold' }}>
                  {value} ref{value !== 1 ? 's' : ''}
                  {value === 0 && (isUserLine || isTeamLine) && (
                    <span style={{ fontSize: '11px', fontStyle: 'italic', color: '#666', marginLeft: '4px' }}>
                      (no activity)
                    </span>
                  )}
                </span>
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  // Format the date for display on X-axis
  const formatXAxisLabel = (tickItem) => {
    const date = new Date(tickItem);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  if (loading) {
    return (
      <div style={{ 
        height: height, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f8f9fa',
        borderRadius: '8px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            fontSize: '16px', 
            color: '#6c757d',
            marginBottom: '8px'
          }}>
            Loading chart data...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        height: height, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f8f9fa',
        borderRadius: '8px'
      }}>
        <div style={{ textAlign: 'center', color: '#dc3545' }}>
          <div style={{ fontSize: '16px', marginBottom: '8px' }}>
            Error loading chart data
          </div>
          <div style={{ fontSize: '14px' }}>
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div style={{ 
        height: height, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f8f9fa',
        borderRadius: '8px'
      }}>
        <div style={{ textAlign: 'center', color: '#6c757d' }}>
          <div style={{ fontSize: '16px', marginBottom: '8px' }}>
            No data available
          </div>
          <div style={{ fontSize: '14px' }}>
            Try adjusting your date range or filters
          </div>
        </div>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        data={chartData}
        margin={{
          top: 20,
          right: 30,
          left: 20,
          bottom: 20,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
        <XAxis 
          dataKey="date"
          tickFormatter={formatXAxisLabel}
          stroke="#6c757d"
          fontSize={12}
          angle={-45}
          textAnchor="end"
          height={60}
        />
        <YAxis stroke="#6c757d" fontSize={12} />
        <Tooltip content={<CustomTooltip />} />
        {showLegend && <Legend />}
        
        {/* All Approved Refs Line */}
        <Line
          type="monotone"
          dataKey="true_refs"
          stroke="#16a34a"
          strokeWidth={3}
          dot={{ fill: '#16a34a', strokeWidth: 2, r: 5 }}
          activeDot={{ r: 7, stroke: '#16a34a', strokeWidth: 2 }}
          name="All Approved Refs"
          connectNulls={false}
        />
        
        {/* User's Approved Refs Line - Always show if data has user_true_refs field */}
        <Line
          type="monotone"
          dataKey="user_true_refs"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
          activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
          name="Your Approved Refs"
          connectNulls={false}
        />
        
        {/* Team's Approved Refs Line - Always show if data has team_true_refs field */}
        <Line
          type="monotone"
          dataKey="team_true_refs"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }}
          activeDot={{ r: 6, stroke: '#f59e0b', strokeWidth: 2 }}
          name="Your Team's Approved Refs"
          connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default RefChart; 