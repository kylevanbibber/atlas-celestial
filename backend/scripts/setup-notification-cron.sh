#!/bin/bash

# Script to set up the cron job for processing scheduled notifications

# Get the absolute path to the process-scheduled-notifications.js script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
NOTIFICATION_SCRIPT="$SCRIPT_DIR/process-scheduled-notifications.js"
NODE_PATH=$(which node)

# Make sure the script exists and is executable
if [ ! -f "$NOTIFICATION_SCRIPT" ]; then
  echo "Error: $NOTIFICATION_SCRIPT does not exist."
  exit 1
fi

chmod +x "$NOTIFICATION_SCRIPT"

# Get the Node.js path
if [ -z "$NODE_PATH" ]; then
  echo "Error: Node.js not found in PATH."
  exit 1
fi

# Create the cron job entry
CRON_ENTRY="* * * * * $NODE_PATH $NOTIFICATION_SCRIPT >> $SCRIPT_DIR/notification-cron.log 2>&1"

# Check if the cron job already exists
EXISTING_CRON=$(crontab -l 2>/dev/null | grep -F "$NOTIFICATION_SCRIPT")

if [ -n "$EXISTING_CRON" ]; then
  echo "Cron job already exists:"
  echo "$EXISTING_CRON"
else
  # Add the cron job
  (crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -
  echo "Cron job added successfully:"
  echo "$CRON_ENTRY"
fi

echo "Notification processing cron job setup complete."
echo "The script will run every minute and process scheduled notifications."
echo "Logs will be written to: $SCRIPT_DIR/notification-cron.log" 