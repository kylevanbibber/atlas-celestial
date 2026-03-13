import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import api from "../../api";
import "../../App.css";

const AdminDashboard = () => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState({
    alp: {
      prevMonthCount: 0,
      codesCount: 0,
      hiresCount: 0,
      vipsCount: 0
    },
    verification: {
      pending: 0,
      verified: 0,
      discrepancy: 0
    },
    refvalidation: {
      blankTrueRef: 0
    }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDashboardMetrics = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Fetch all metrics in parallel
        const [alpResponse, verificationResponse, refvalidationResponse] = await Promise.all([
          api.get("/admin/dashboard/alp-metrics"),
          api.get("/admin/dashboard/verification-metrics"),
          api.get("/admin/dashboard/refvalidation-metrics")
        ]);

        setMetrics({
          alp: alpResponse.data.success ? alpResponse.data.data : {
            prevMonthCount: 0,
            codesCount: 0,
            hiresCount: 0,
            vipsCount: 0
          },
          verification: verificationResponse.data.success ? verificationResponse.data.data : {
            pending: 0,
            verified: 0,
            discrepancy: 0
          },
          refvalidation: refvalidationResponse.data.success ? refvalidationResponse.data.data : {
            blankTrueRef: 0
          }
        });
      } catch (error) {
        console.error("Error fetching dashboard metrics:", error);
        setError("Failed to load dashboard data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardMetrics();
  }, []);

  const MetricCard = ({ title, value, subtitle, color = "primary" }) => (
    <div className={`metric-card metric-card-${color}`}>
      <div className="metric-title">{title}</div>
      <div className="metric-value">{value}</div>
      {subtitle && <div className="metric-subtitle">{subtitle}</div>}
    </div>
  );

  if (isLoading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p style={{ color: "red" }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "1rem" }}>
      <h2>Admin Dashboard</h2>
      
      {/* ALP Metrics Section */}
      <div style={{ marginBottom: "2rem" }}>
        <h3 style={{ marginBottom: "1rem", color: "#333" }}>ALP Metrics</h3>
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
          gap: "1rem" 
        }}>
          <MetricCard 
            title="Previous Month ALP"
            value={metrics.alp.prevMonthCount}
            subtitle="Applications"
            color="blue"
          />
          <MetricCard 
            title="Codes"
            value={metrics.alp.codesCount}
            subtitle="Total Codes"
            color="green"
          />
          <MetricCard 
            title="Hires"
            value={metrics.alp.hiresCount}
            subtitle="Total Hires"
            color="orange"
          />
          <MetricCard 
            title="VIPs"
            value={metrics.alp.vipsCount}
            subtitle="Total VIPs"
            color="purple"
          />
        </div>
      </div>

      {/* Verification Metrics Section */}
      <div style={{ marginBottom: "2rem" }}>
        <h3 style={{ marginBottom: "1rem", color: "#333" }}>Verification Status</h3>
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
          gap: "1rem" 
        }}>
          <MetricCard 
            title="Pending Verification"
            value={metrics.verification.pending}
            subtitle="Applications"
            color="warning"
          />
          <MetricCard 
            title="Verified"
            value={metrics.verification.verified}
            subtitle="Applications"
            color="success"
          />
          <MetricCard 
            title="Discrepancy"
            value={metrics.verification.discrepancy}
            subtitle="Applications"
            color="danger"
          />
        </div>
      </div>

      {/* RefValidation Metrics Section */}
      <div style={{ marginBottom: "2rem" }}>
        <h3 style={{ marginBottom: "1rem", color: "#333" }}>Ref Validation</h3>
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
          gap: "1rem" 
        }}>
          <MetricCard 
            title="Blank True Ref"
            value={metrics.refvalidation.blankTrueRef}
            subtitle="Records"
            color="info"
          />
        </div>
      </div>

      {/* Dashboard Styles */}
      <style>
        {`
          .metric-card {
            background: white;
            border-radius: 8px;
            padding: 1.5rem;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            border-left: 4px solid;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
          }
          
          .metric-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.15);
          }
          
          .metric-card-primary {
            border-left-color: var(--primary-color);
          }
          
          .metric-card-blue {
            border-left-color: #3498db;
          }
          
          .metric-card-green {
            border-left-color: #2ecc71;
          }
          
          .metric-card-orange {
            border-left-color: #f39c12;
          }
          
          .metric-card-purple {
            border-left-color: #9b59b6;
          }
          
          .metric-card-warning {
            border-left-color: #f1c40f;
          }
          
          .metric-card-success {
            border-left-color: #27ae60;
          }
          
          .metric-card-danger {
            border-left-color: #e74c3c;
          }
          
          .metric-card-info {
            border-left-color: #17a2b8;
          }
          
          .metric-title {
            font-size: 0.9rem;
            font-weight: 600;
            color: #666;
            margin-bottom: 0.5rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          
          .metric-value {
            font-size: 2rem;
            font-weight: bold;
            color: #333;
            margin-bottom: 0.25rem;
          }
          
          .metric-subtitle {
            font-size: 0.8rem;
            color: #999;
            font-style: italic;
          }
        `}
      </style>
    </div>
  );
};

export default AdminDashboard; 