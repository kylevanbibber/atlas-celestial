import React, { useState, useEffect } from 'react';
import './Widgets.css';

const ChartWidget = ({ chartType = 'line', dataSource = 'activity', onError }) => {
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChartData();
  }, [chartType, dataSource]);

  const fetchChartData = async () => {
    try {
      setLoading(true);
      
      // Mock chart data - replace with actual API calls
      const mockData = {
        activity: {
          labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          values: [12, 19, 8, 15, 22, 8, 14],
          color: '#667eea'
        },
        sales: {
          labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
          values: [45000, 52000, 48000, 58000, 62000, 55000],
          color: '#28a745'
        },
        performance: {
          labels: ['Q1', 'Q2', 'Q3', 'Q4'],
          values: [85, 92, 78, 95],
          color: '#ffc107'
        }
      };

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 400));
      
      setChartData(mockData[dataSource] || mockData.activity);
    } catch (error) {
      onError && onError(error);
    } finally {
      setLoading(false);
    }
  };

  const renderLineChart = () => {
    const maxValue = Math.max(...chartData.values);
    const points = chartData.values.map((value, index) => {
      const x = (index / (chartData.values.length - 1)) * 100;
      const y = 100 - (value / maxValue) * 80; // 80% of height for chart area
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg viewBox="0 0 100 100" className="line-chart">
        <polyline
          fill="none"
          stroke={chartData.color}
          strokeWidth="2"
          points={points}
        />
        {chartData.values.map((value, index) => {
          const x = (index / (chartData.values.length - 1)) * 100;
          const y = 100 - (value / maxValue) * 80;
          return (
            <circle
              key={index}
              cx={x}
              cy={y}
              r="1.5"
              fill={chartData.color}
            />
          );
        })}
      </svg>
    );
  };

  const renderBarChart = () => {
    const maxValue = Math.max(...chartData.values);
    return (
      <div className="bar-chart">
        {chartData.values.map((value, index) => (
          <div key={index} className="bar-container">
            <div
              className="bar"
              style={{
                height: `${(value / maxValue) * 100}%`,
                backgroundColor: chartData.color
              }}
            ></div>
            <span className="bar-label">{chartData.labels[index]}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderPieChart = () => {
    const total = chartData.values.reduce((sum, value) => sum + value, 0);
    let currentAngle = 0;
    
    return (
      <svg viewBox="0 0 100 100" className="pie-chart">
        {chartData.values.map((value, index) => {
          const percentage = (value / total) * 100;
          const angle = (value / total) * 360;
          
          const x1 = 50 + 40 * Math.cos((currentAngle - 90) * Math.PI / 180);
          const y1 = 50 + 40 * Math.sin((currentAngle - 90) * Math.PI / 180);
          
          currentAngle += angle;
          
          const x2 = 50 + 40 * Math.cos((currentAngle - 90) * Math.PI / 180);
          const y2 = 50 + 40 * Math.sin((currentAngle - 90) * Math.PI / 180);
          
          const largeArcFlag = angle > 180 ? 1 : 0;
          
          return (
            <path
              key={index}
              d={`M 50,50 L ${x1},${y1} A 40,40 0 ${largeArcFlag},1 ${x2},${y2} z`}
              fill={`hsl(${index * 45}, 70%, 60%)`}
            />
          );
        })}
      </svg>
    );
  };

  if (loading) {
    return (
      <div className="widget-loading">
        <div className="spinner"></div>
        <span>Loading chart...</span>
      </div>
    );
  }

  if (!chartData) {
    return (
      <div className="widget-error">
        Unable to load chart data
      </div>
    );
  }

  return (
    <div className="chart-widget">
      <div className="chart-header">
        <span className="chart-title">
          {dataSource.charAt(0).toUpperCase() + dataSource.slice(1)} Data
        </span>
        <span className="chart-type">{chartType}</span>
      </div>
      
      <div className="chart-container">
        {chartType === 'line' && renderLineChart()}
        {chartType === 'bar' && renderBarChart()}
        {(chartType === 'pie' || chartType === 'doughnut') && renderPieChart()}
      </div>
      
      <div className="chart-legend">
        {chartData.labels.map((label, index) => (
          <div key={index} className="legend-item">
            <span 
              className="legend-color"
              style={{ 
                backgroundColor: chartType === 'pie' || chartType === 'doughnut' 
                  ? `hsl(${index * 45}, 70%, 60%)` 
                  : chartData.color 
              }}
            ></span>
            <span className="legend-label">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChartWidget;