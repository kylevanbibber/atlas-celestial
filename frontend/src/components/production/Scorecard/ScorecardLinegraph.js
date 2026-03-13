import React from "react";
import { Bar } from "react-chartjs-2";
import "chart.js/auto"; // Automatically registers Chart.js components

const ScorecardBarGraph = ({ vipsData, associatesData }) => {
  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const groupDataByMonthYear = (data, dateField) => {
    return data.reduce((acc, item) => {
      const date = new Date(item[dateField]);
      const year = date.getFullYear();
      const month = date.getMonth(); // 0-based index for month

      if (!acc[year]) acc[year] = Array(12).fill(0); // Initialize months for the year
      acc[year][month] += 1; // Increment the count for the month

      return acc;
    }, {});
  };

  const createBarChartData = (data, dateField, label) => {
    const groupedData = groupDataByMonthYear(data, dateField);

    const currentYearData = groupedData[currentYear] || Array(12).fill(0);
    const previousYearData = groupedData[previousYear] || Array(12).fill(0);

    return {
      labels: months,
      datasets: [
        {
          label: `${label} ${previousYear}`,
          data: previousYearData,
          backgroundColor: "rgba(255, 99, 132, 0.6)",
          borderColor: "rgba(255, 99, 132, 1)",
          borderWidth: 1,
        },
        {
          label: `${label} ${currentYear}`,
          data: currentYearData,
          backgroundColor: "rgba(54, 162, 235, 0.6)",
          borderColor: "rgba(54, 162, 235, 1)",
          borderWidth: 1,
        },
      ],
    };
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "top",
      },
      title: {
        display: true,
        text: "Monthly Data Comparison",
      },
    },
    scales: {
      x: {
        stacked: false, // Set to true for stacked bar graphs
      },
      y: {
        beginAtZero: true,
      },
    },
  };

  return (
    <div className="bargraph-container">
      <h2>Scorecard Bar Graphs</h2>
      <div className="bargraph">
        <h3>VIPs</h3>
        <Bar
          data={createBarChartData(vipsData, "vip_month", "VIPs")}
          options={chartOptions}
        />
        <h3>Associates</h3>
        <Bar
          data={createBarChartData(associatesData, "PRODDATE", "Associates")}
          options={chartOptions}
        />
      </div>
    </div>
  );
};

export default ScorecardBarGraph;
