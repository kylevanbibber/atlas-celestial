import React, { useState } from 'react';
import './WidgetLibrary.css';

const AVAILABLE_WIDGETS = [
  {
    type: 'StatCard',
    name: 'Statistics Card',
    description: 'Display key metrics and statistics',
    category: 'Analytics',
    icon: '📊',
    defaultSize: { width: 1, height: 1 },
    defaultProps: { variant: 'default' }
  },
  {
    type: 'ActivityCard',
    name: 'Activity Feed',
    description: 'Recent activity and events',
    category: 'Activity',
    icon: '📋',
    defaultSize: { width: 2, height: 1 },
    defaultProps: { showRecent: 5 }
  },
  {
    type: 'Scorecard',
    name: 'Scorecard',
    description: 'Performance scorecard view',
    category: 'Analytics',
    icon: '🎯',
    defaultSize: { width: 2, height: 2 },
    defaultProps: { view: 'summary' }
  },
  {
    type: 'Leaderboard',
    name: 'Leaderboard',
    description: 'Top performers ranking',
    category: 'Competition',
    icon: '🏆',
    defaultSize: { width: 1, height: 2 },
    defaultProps: { limit: 10 }
  },
  {
    type: 'Chart',
    name: 'Charts & Graphs',
    description: 'Data visualization charts',
    category: 'Analytics',
    icon: '📈',
    defaultSize: { width: 2, height: 1 },
    defaultProps: { chartType: 'line', dataSource: 'activity' }
  },
  {
    type: 'Todo',
    name: 'Todo List',
    description: 'Personal task management',
    category: 'Productivity',
    icon: '✅',
    defaultSize: { width: 1, height: 2 },
    defaultProps: { showCompleted: false }
  },
  {
    type: 'Weather',
    name: 'Weather Widget',
    description: 'Current weather information',
    category: 'Information',
    icon: '🌤️',
    defaultSize: { width: 1, height: 1 },
    defaultProps: { location: 'auto' }
  },
  {
    type: 'Calendar',
    name: 'Calendar',
    description: 'Upcoming events and schedule with Calendly sync',
    category: 'Productivity',
    icon: '📅',
    defaultSize: { width: 2, height: 2 },
    defaultProps: { view: 'upcoming', maxEvents: 5 }
  }
];

const CATEGORIES = ['All', 'Analytics', 'Activity', 'Competition', 'Productivity', 'Information'];

const WidgetLibrary = ({ onAddWidget, onClose }) => {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredWidgets = AVAILABLE_WIDGETS.filter(widget => {
    const matchesCategory = selectedCategory === 'All' || widget.category === selectedCategory;
    const matchesSearch = widget.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         widget.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleAddWidget = (widgetConfig) => {
    const newWidget = {
      type: widgetConfig.type,
      title: widgetConfig.name,
      size: widgetConfig.defaultSize,
      props: widgetConfig.defaultProps
    };
    onAddWidget(newWidget);
  };

  return (
    <div className="widget-library-modal">
      <div className="modal-backdrop" onClick={onClose}></div>
      <div className="widget-library-content">
        <div className="widget-library-header">
          <h2>Widget Library</h2>
          <button className="btn btn-sm close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="widget-library-controls">
          <div className="search-container">
            <input
              type="text"
              placeholder="Search widgets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          
          <div className="category-filters">
            {CATEGORIES.map(category => (
              <button
                key={category}
                className={`category-btn ${selectedCategory === category ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <div className="widget-library-body">
          {filteredWidgets.length === 0 ? (
            <div className="no-widgets">
              <p>No widgets found matching your criteria.</p>
            </div>
          ) : (
            <div className="widgets-grid">
              {filteredWidgets.map(widget => (
                <WidgetCard
                  key={widget.type}
                  widget={widget}
                  onAdd={() => handleAddWidget(widget)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="widget-library-footer">
          <p className="help-text">
            Click on any widget to add it to your dashboard. You can customize and rearrange widgets after adding them.
          </p>
        </div>
      </div>
    </div>
  );
};

const WidgetCard = ({ widget, onAdd }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className="widget-card"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onAdd}
    >
      <div className="widget-card-icon">
        {widget.icon}
      </div>
      
      <div className="widget-card-content">
        <h3 className="widget-card-title">{widget.name}</h3>
        <p className="widget-card-description">{widget.description}</p>
        
        <div className="widget-card-meta">
          <span className="widget-category">{widget.category}</span>
          <span className="widget-size">
            {widget.defaultSize.width}×{widget.defaultSize.height}
          </span>
        </div>
      </div>
      
      {isHovered && (
        <div className="widget-card-overlay">
          <button className="add-widget-btn">
            Add Widget
          </button>
        </div>
      )}
    </div>
  );
};

export default WidgetLibrary;