import React, { useState, useEffect } from 'react';
import './Widgets.css';

const WeatherWidget = ({ location = 'auto', onError }) => {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWeather();
  }, [location]);

  const fetchWeather = async () => {
    try {
      setLoading(true);
      
      // Mock weather data - replace with actual API calls (OpenWeatherMap, etc.)
      const mockWeather = {
        location: location === 'auto' ? 'New York, NY' : location,
        current: {
          temperature: 72,
          condition: 'Partly Cloudy',
          icon: '⛅',
          humidity: 65,
          windSpeed: 8
        },
        forecast: [
          { day: 'Today', high: 75, low: 68, icon: '⛅' },
          { day: 'Tomorrow', high: 78, low: 70, icon: '☀️' },
          { day: 'Wed', high: 73, low: 65, icon: '🌧️' },
          { day: 'Thu', high: 76, low: 69, icon: '☀️' },
        ]
      };

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 300));
      
      setWeather(mockWeather);
    } catch (error) {
      onError && onError(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="widget-loading">
        <div className="spinner"></div>
        <span>Loading weather...</span>
      </div>
    );
  }

  if (!weather) {
    return (
      <div className="widget-error">
        Unable to load weather data
      </div>
    );
  }

  return (
    <div className="weather-widget">
      <div className="weather-current">
        <div className="weather-location">{weather.location}</div>
        <div className="weather-main">
          <div className="weather-icon">{weather.current.icon}</div>
          <div className="weather-temp">{weather.current.temperature}°F</div>
        </div>
        <div className="weather-condition">{weather.current.condition}</div>
        
        <div className="weather-details">
          <div className="weather-detail">
            <span className="detail-label">Humidity</span>
            <span className="detail-value">{weather.current.humidity}%</span>
          </div>
          <div className="weather-detail">
            <span className="detail-label">Wind</span>
            <span className="detail-value">{weather.current.windSpeed} mph</span>
          </div>
        </div>
      </div>

      <div className="weather-forecast">
        {weather.forecast.map((day, index) => (
          <div key={index} className="forecast-day">
            <div className="forecast-day-name">{day.day}</div>
            <div className="forecast-icon">{day.icon}</div>
            <div className="forecast-temps">
              <span className="forecast-high">{day.high}°</span>
              <span className="forecast-low">{day.low}°</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WeatherWidget;