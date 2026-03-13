CREATE TABLE IF NOT EXISTS payeeweb_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  report_year INT NOT NULL,
  report_week_number INT NOT NULL,
  raw_data JSON,
  downloaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_year_week (report_year, report_week_number)
);
