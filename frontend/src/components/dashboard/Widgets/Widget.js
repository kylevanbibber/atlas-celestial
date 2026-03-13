import React, { useState, Suspense } from 'react';
import ActivityCardWidget from './ActivityCardWidget';
import ScorecardWidget from './ScorecardWidget';
import LeaderboardWidget from './LeaderboardWidget';
import ChartWidget from './ChartWidget';
import TodoWidget from './TodoWidget';
import WeatherWidget from './WeatherWidget';
import CalendarWidget from './CalendarWidget';

// Widget type mapping
const WIDGET_COMPONENTS = {
  'StatCard': StatCardWidget,
  'ActivityCard': ActivityCardWidget,
  'Scorecard': ScorecardWidget,
  'Leaderboard': LeaderboardWidget,
  'Chart': ChartWidget,
  'Todo': TodoWidget,
  'Weather': WeatherWidget,
  'Calendar': CalendarWidget,
};

const Widget = ({ widget, isEditMode, onRemove, onUpdate }) => {
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [error, setError] = useState(null);

  const WidgetComponent = WIDGET_COMPONENTS[widget.type];

  if (!WidgetComponent) {
    return (
      <div className="dashboard-widget">
        <div className="widget-header">
          <h3 className="widget-title">Unknown Widget</h3>
          {isEditMode && (
            <div className="widget-controls always-visible">
              <button 
                className="btn btn-danger btn-sm"
                onClick={onRemove}
                title="Remove widget"
              >
                ✕
              </button>
            </div>
          )}
        </div>
        <div className="widget-content">
          <div className="widget-error">
            Widget type "{widget.type}" not found
          </div>
        </div>
      </div>
    );
  }

  const handleConfigSave = (newConfig) => {
    onUpdate({
      ...widget,
      ...newConfig
    });
    setIsConfiguring(false);
  };

  const handleResize = (newSize) => {
    onUpdate({
      size: newSize
    });
  };

  return (
    <div className="dashboard-widget">
      <div className="widget-header">
        <h3 className="widget-title">{widget.title}</h3>
        {isEditMode && (
          <div className="widget-controls always-visible">
            <button 
              className="btn btn-sm"
              onClick={() => setIsConfiguring(true)}
              title="Configure widget"
            >
              ⚙️
            </button>
            <button 
              className="btn btn-sm"
              onClick={() => handleResize({
                width: widget.size.width === 1 ? 2 : 1,
                height: widget.size.height
              })}
              title="Resize widget"
            >
              ↔️
            </button>
            <button 
              className="btn btn-danger btn-sm"
              onClick={onRemove}
              title="Remove widget"
            >
              ✕
            </button>
          </div>
        )}
      </div>
      
      <div className="widget-content">
        <Suspense fallback={
          <div className="widget-loading">
            <div>Loading widget...</div>
          </div>
        }>
          {error ? (
            <div className="widget-error">
              Error loading widget: {error.message}
            </div>
          ) : (
            <WidgetComponent 
              {...widget.props}
              onError={setError}
              isEditMode={isEditMode}
            />
          )}
        </Suspense>
      </div>

      {/* Configuration Modal */}
      {isConfiguring && (
        <WidgetConfigModal 
          widget={widget}
          onSave={handleConfigSave}
          onCancel={() => setIsConfiguring(false)}
        />
      )}
    </div>
  );
};

// Widget Configuration Modal Component
const WidgetConfigModal = ({ widget, onSave, onCancel }) => {
  const [config, setConfig] = useState({
    title: widget.title,
    props: { ...widget.props },
    size: { ...widget.size }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(config);
  };

  return (
    <div className="widget-config-modal">
      <div className="modal-backdrop" onClick={onCancel}></div>
      <div className="modal-content">
        <div className="modal-header">
          <h4>Configure Widget</h4>
          <button className="btn btn-sm" onClick={onCancel}>✕</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>Widget Title:</label>
              <input 
                type="text"
                value={config.title}
                onChange={(e) => setConfig({
                  ...config,
                  title: e.target.value
                })}
                className="form-control"
              />
            </div>
            
            <div className="form-group">
              <label>Width (columns):</label>
              <input 
                type="number"
                min="1"
                max="4"
                value={config.size.width}
                onChange={(e) => setConfig({
                  ...config,
                  size: { ...config.size, width: parseInt(e.target.value) }
                })}
                className="form-control"
              />
            </div>
            
            <div className="form-group">
              <label>Height (rows):</label>
              <input 
                type="number"
                min="1"
                max="3"
                value={config.size.height}
                onChange={(e) => setConfig({
                  ...config,
                  size: { ...config.size, height: parseInt(e.target.value) }
                })}
                className="form-control"
              />
            </div>

            {/* Widget-specific configuration */}
            <WidgetSpecificConfig 
              widgetType={widget.type}
              props={config.props}
              onChange={(newProps) => setConfig({
                ...config,
                props: { ...config.props, ...newProps }
              })}
            />
          </div>
          
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Widget-specific configuration component
const WidgetSpecificConfig = ({ widgetType, props, onChange }) => {
  switch (widgetType) {
    case 'StatCard':
      return (
        <div className="form-group">
          <label>Variant:</label>
          <select 
            value={props.variant || 'default'}
            onChange={(e) => onChange({ variant: e.target.value })}
            className="form-control"
          >
            <option value="default">Default</option>
            <option value="overview">Overview</option>
            <option value="summary">Summary</option>
            <option value="detailed">Detailed</option>
          </select>
        </div>
      );
      
    case 'ActivityCard':
      return (
        <div className="form-group">
          <label>Show Recent Items:</label>
          <input 
            type="number"
            min="1"
            max="20"
            value={props.showRecent || 5}
            onChange={(e) => onChange({ showRecent: parseInt(e.target.value) })}
            className="form-control"
          />
        </div>
      );
      
    case 'Chart':
      return (
        <>
          <div className="form-group">
            <label>Chart Type:</label>
            <select 
              value={props.chartType || 'line'}
              onChange={(e) => onChange({ chartType: e.target.value })}
              className="form-control"
            >
              <option value="line">Line Chart</option>
              <option value="bar">Bar Chart</option>
              <option value="pie">Pie Chart</option>
              <option value="doughnut">Doughnut Chart</option>
            </select>
          </div>
          <div className="form-group">
            <label>Data Source:</label>
            <select 
              value={props.dataSource || 'activity'}
              onChange={(e) => onChange({ dataSource: e.target.value })}
              className="form-control"
            >
              <option value="activity">Activity Data</option>
              <option value="sales">Sales Data</option>
              <option value="performance">Performance Data</option>
            </select>
          </div>
        </>
      );
      
    default:
      return null;
  }
};

export default Widget;