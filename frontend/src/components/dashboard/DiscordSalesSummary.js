/**
 * Discord Sales Summary Component
 * Displays Discord sales data in the expanded agent details row
 */

import React from 'react';
import { formatCurrency } from '../../utils/dashboardHelpers';

const DiscordSalesSummary = ({ discordSalesData, agentKey }) => {
  const agentDiscordSales = discordSalesData[agentKey];
  
  if (!agentDiscordSales || Object.keys(agentDiscordSales).length === 0) {
    return (
      <div className="bg-background p-4 rounded-lg border border-border text-center">
        <p className="text-sm text-muted-foreground">
          No sales reported through discord for this agent.
        </p>
      </div>
    );
  }

  // Calculate totals and group by lead type
  let totalSales = 0;
  let totalAlp = 0;
  let totalRefs = 0;
  const byLeadType = {};

  Object.values(agentDiscordSales).forEach(salesForDate => {
    salesForDate.forEach(sale => {
      totalSales += 1;
      const alp = parseFloat(sale.alp) || 0;
      const refs = parseInt(sale.refs) || 0;
      totalAlp += alp;
      totalRefs += refs;

      // Group by lead type
      const leadType = sale.lead_type || 'unknown';
      if (!byLeadType[leadType]) {
        byLeadType[leadType] = { count: 0, alp: 0, refs: 0 };
      }
      byLeadType[leadType].count += 1;
      byLeadType[leadType].alp += alp;
      byLeadType[leadType].refs += refs;
    });
  });

  const avgAlp = totalSales > 0 ? totalAlp / totalSales : 0;
  const avgRefs = totalSales > 0 ? totalRefs / totalSales : 0;

  // Sort lead types by ALP descending
  const leadTypeArray = Object.entries(byLeadType)
    .map(([type, data]) => ({ type, ...data }))
    .sort((a, b) => b.alp - a.alp);

  return (
    <>
      <div className="bg-background p-3 sm:p-4 rounded-lg border border-border">
        <h4 className="text-xs sm:text-sm font-semibold mb-3">Discord Sales Summary</h4>
        
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4 mb-4">
          <div className="bg-accent/50 p-2 sm:p-3 rounded">
            <p className="text-xs text-muted-foreground">Total Sales</p>
            <p className="text-xl sm:text-2xl font-bold text-foreground">{totalSales}</p>
          </div>
          <div className="bg-accent/50 p-2 sm:p-3 rounded">
            <p className="text-xs text-muted-foreground">Total Premium</p>
            <p className="text-xl sm:text-2xl font-bold text-primary">{formatCurrency(totalAlp)}</p>
          </div>
          <div className="bg-accent/50 p-2 sm:p-3 rounded col-span-2 lg:col-span-1">
            <p className="text-xs text-muted-foreground">Average ALP</p>
            <p className="text-xl sm:text-2xl font-bold text-green-600">{formatCurrency(avgAlp)}</p>
            <p className="text-xs text-muted-foreground mt-1">Per sale</p>
          </div>
        </div>

        {/* Refs Summary */}
        <div className="grid grid-cols-2 gap-2 sm:gap-4">
          <div className="bg-accent/50 p-2 sm:p-3 rounded">
            <p className="text-xs text-muted-foreground">Total Refs</p>
            <p className="text-lg font-bold text-foreground">{totalRefs}</p>
          </div>
          <div className="bg-accent/50 p-2 sm:p-3 rounded">
            <p className="text-xs text-muted-foreground">Average Refs</p>
            <p className="text-lg font-bold text-foreground">{avgRefs.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">Per sale</p>
          </div>
        </div>
      </div>

      {/* By Lead Type Breakdown */}
      {leadTypeArray.length > 0 && (
        <div className="bg-background p-3 sm:p-4 rounded-lg border border-border">
          <h4 className="text-xs sm:text-sm font-semibold mb-2 sm:mb-3">By Lead Type</h4>
          <div className="space-y-1.5 sm:space-y-2">
            {leadTypeArray.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-xs sm:text-sm gap-2 p-2 bg-accent/30 rounded">
                <span className="text-muted-foreground truncate flex-1">
                  <span className="px-1.5 py-0.5 bg-primary/20 text-primary rounded text-xs font-medium">
                    {item.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                </span>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-muted-foreground">
                    {item.count} sale{item.count !== 1 ? 's' : ''}
                  </span>
                  <span className="font-medium whitespace-nowrap text-foreground">
                    {formatCurrency(item.alp)}
                  </span>
                  <span className="text-muted-foreground">
                    {item.refs} ref{item.refs !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export default DiscordSalesSummary;
