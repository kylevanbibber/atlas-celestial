import os
import pandas as pd
import datetime
import win32com.client
import requests
import mysql.connector
import json
import re
from msal import PublicClientApplication

# === Database Configuration ===
DB_CONFIG = {
    'host': '208.109.78.44',
    'user': 'kvanbibber',
    'password': 'Atlas2024!',
    'database': 'AriasLifeUsers',
    'charset': 'utf8mb4'
}

# === Microsoft Graph App Registration ===
CLIENT_ID = 'd04bf33d-824c-46f5-b75d-d25eb50f7be6'
TENANT_ID = '56c93141-522f-4eb8-9abc-006b4b8033ce'
SCOPES = ['https://graph.microsoft.com/Files.ReadWrite.All', 'https://graph.microsoft.com/User.Read']
ONEDRIVE_UPLOAD_FOLDER = 'Reports/VIPs'

# === Email & File Filters ===
OUTLOOK_FOLDER = "Inbox"
KEYWORDS = ["Code Potential"]
ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv']
EXCLUDED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp']
CREATED_BY = 19263
UPDATED_BY = 19263

# === Database Helper Functions ===
def get_db_connection():
    """Create and return a database connection"""
    return mysql.connector.connect(**DB_CONFIG)

def get_user_id():
    """Get a valid user ID from the database"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Try to get the specified user first
        cursor.execute("SELECT id FROM activeusers WHERE id = %s", (CREATED_BY,))
        result = cursor.fetchone()
        
        if result:
            return result[0]
        
        # Fallback to first available user
        cursor.execute("SELECT id FROM activeusers ORDER BY id LIMIT 1")
        result = cursor.fetchone()
        
        if result:
            print(f"Warning: User {CREATED_BY} not found, using user {result[0]} instead")
            return result[0]
        
        # If no users exist, return None (will be handled as NULL in database)
        print("Warning: No users found in database")
        return None
        
    finally:
        cursor.close()
        conn.close()

def extract_base_report_name(file_name):
    """Extract the base report name without date patterns"""
    # Remove file extension
    name_without_ext = os.path.splitext(file_name)[0]
    
    # Common date patterns to remove
    date_patterns = [
        r'\s+\d{2}-\d{2}-\d{4}$',           # " 07-15-2024"
        r'\s+\d{1,2}-\d{1,2}-\d{4}$',       # " 7-15-2024"
        r'\s+\d{2}-\d{2}-\d{2}$',           # " 07-15-24" (2-digit year)
        r'\s+\d{1,2}-\d{1,2}-\d{2}$',       # " 7-15-24" (2-digit year)
        r'\s+\d{4}-\d{2}-\d{2}$',           # " 2024-07-15"
        r'\s+\d{2}/\d{2}/\d{4}$',           # " 07/15/2024"
        r'\s+\d{1,2}/\d{1,2}/\d{4}$',       # " 7/15/2024"
        r'\s+\d{2}/\d{2}/\d{2}$',           # " 07/15/24" (2-digit year)
        r'\s+\d{1,2}/\d{1,2}/\d{2}$',       # " 7/15/24" (2-digit year)
        r'\s+\d{2}\.\d{2}\.\d{4}$',         # " 07.15.2024"
        r'\s+through\s+\d{2}/\d{2}/\d{4}$', # " through 07/15/2024"
        r'\s+\w{3}\s+\d{1,2},?\s+\d{4}$',   # " Jul 15, 2024" or " Jul 15 2024"
        r'\s+\d{8}\)$',                     # " 08022024)" - special case
    ]
    
    base_name = name_without_ext
    for pattern in date_patterns:
        base_name = re.sub(pattern, '', base_name, flags=re.IGNORECASE)
    
    # Clean up any trailing spaces or common suffixes
    base_name = base_name.strip()
    base_name = re.sub(r'\s+(Report|Summary|Data)$', r' \1', base_name, flags=re.IGNORECASE)
    
    return base_name

def get_category_id(category_name='VIPs'):
    """Get or create a category and return its ID"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Try to find existing category
        cursor.execute("SELECT id FROM file_categories WHERE name = %s", (category_name,))
        result = cursor.fetchone()
        
        if result:
            return result[0]
        
        # Create new category if it doesn't exist
        cursor.execute(
            "INSERT INTO file_categories (name, description, created_at) VALUES (%s, %s, NOW())",
            (category_name, f"Auto-created category for {category_name} reports")
        )
        conn.commit()
        return cursor.lastrowid
        
    finally:
        cursor.close()
        conn.close()

def check_existing_report(file_name, category_id):
    """Check if a report with the same base name and category already exists"""
    base_name = extract_base_report_name(file_name)
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # First try exact match with base name
        cursor.execute(
            "SELECT id, report_name FROM onedrive_reports WHERE report_name = %s AND category_id = %s ORDER BY added_at DESC LIMIT 1",
            (base_name, category_id)
        )
        result = cursor.fetchone()
        
        if result:
            return result[0]
        
        # If no exact match, look for reports that start with the base name
        cursor.execute(
            "SELECT id, report_name FROM onedrive_reports WHERE report_name LIKE %s AND category_id = %s ORDER BY added_at DESC LIMIT 1",
            (f"{base_name}%", category_id)
        )
        result = cursor.fetchone()
        
        if result:
            # Check if the existing report also has the same base name
            existing_base = extract_base_report_name(result[1])
            if existing_base == base_name:
                return result[0]
        
        return None
        
    finally:
        cursor.close()
        conn.close()

def create_new_report(report_data, user_id, category_id):
    """Create a new report in the onedrive_reports table"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            INSERT INTO onedrive_reports (
                report_name, report_description, category_id, frequency, onedrive_url,
                file_name, file_size, file_type, upload_date, is_hidden, is_from_home_office,
                priority, tags, metadata, subject, created_by, updated_by, added_at, updated_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW()
            )
        """, (
            report_data['report_name'],
            report_data['report_description'],
            category_id,
            report_data['frequency'],
            report_data['onedrive_url'],
            report_data['file_name'],
            report_data['file_size'],
            report_data['file_type'],
            report_data['upload_date'],
            report_data['is_hidden'],
            report_data['is_from_home_office'],
            report_data['priority'],
            json.dumps(report_data['tags']),  # Convert to JSON string
            json.dumps(report_data['metadata']),  # Convert to JSON string
            report_data['subject'],
            user_id,
            user_id
        ))
        
        conn.commit()
        return cursor.lastrowid
        
    finally:
        cursor.close()
        conn.close()

def create_report_version(report_id, report_data, user_id, is_current=True):
    """Create a new version for an existing report"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Mark previous versions as not current if this is the new current version
        if is_current:
            cursor.execute(
                "UPDATE report_versions SET is_current = FALSE WHERE report_id = %s",
                (report_id,)
            )
        
        # Create version name based on upload date
        version_name = f"Version {report_data['upload_date']}"
        version_notes = f"Auto-imported from email: {report_data['subject']}"
        
        # Insert new version
        cursor.execute("""
            INSERT INTO report_versions (
                report_id, version_name, file_name, onedrive_url, file_size,
                upload_date, is_current, version_notes, created_by, created_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW()
            )
        """, (
            report_id,
            version_name,
            report_data['file_name'],
            report_data['onedrive_url'],
            report_data['file_size'],
            report_data['upload_date'],
            is_current,
            version_notes,
            user_id
        ))
        
        # Update main report with latest version info if this is current
        if is_current:
            cursor.execute("""
                UPDATE onedrive_reports 
                SET onedrive_url = %s, file_name = %s, file_size = %s, upload_date = %s,
                    updated_by = %s, updated_at = NOW()
                WHERE id = %s
            """, (
                report_data['onedrive_url'],
                report_data['file_name'],
                report_data['file_size'],
                report_data['upload_date'],
                user_id,
                report_id
            ))
        
        conn.commit()
        return cursor.lastrowid
        
    finally:
        cursor.close()
        conn.close()

# === Microsoft Graph Functions ===
def get_graph_token():
    app = PublicClientApplication(client_id=CLIENT_ID, authority=f"https://login.microsoftonline.com/{TENANT_ID}")
    flow = app.initiate_device_flow(scopes=SCOPES)
    
    print(flow['message'])
    print("\n⏳ Waiting for authentication to complete...")
    print("   Please complete the authentication in your browser before continuing.")
    print("   The script will automatically proceed once authentication is successful.\n")
    
    result = app.acquire_token_by_device_flow(flow)

    if "access_token" in result:
        print("✅ Authentication successful!")
        return result["access_token"]
    else:
        print(f"❌ Authentication failed: {result.get('error_description', 'Unknown error')}")
        if 'error' in result:
            print(f"   Error code: {result['error']}")
        raise Exception("Could not acquire token")

def upload_to_onedrive(file_path, access_token):
    headers = {'Authorization': f'Bearer {access_token}'}
    file_name = os.path.basename(file_path)
    upload_url = f"https://graph.microsoft.com/v1.0/me/drive/root:/{ONEDRIVE_UPLOAD_FOLDER}/{file_name}:/content"
    with open(file_path, 'rb') as f:
        upload_response = requests.put(upload_url, headers=headers, data=f)
    upload_response.raise_for_status()
    return upload_response.json()['id']

def get_onedrive_share_link(file_id, access_token):
    headers = {'Authorization': f'Bearer {access_token}'}
    link_url = f"https://graph.microsoft.com/v1.0/me/drive/items/{file_id}/createLink"
    payload = { "type": "view", "scope": "anonymous" }
    response = requests.post(link_url, headers=headers, json=payload)
    response.raise_for_status()
    return response.json()['link']['webUrl']

# === Process Outlook Emails ===
def process_emails_to_database(access_token):
    print("🔍 Connecting to Outlook...")
    outlook = win32com.client.Dispatch("Outlook.Application").GetNamespace("MAPI")
    
    print("📂 Accessing inbox...")
    inbox = outlook.Folders.Item(1).Folders[OUTLOOK_FOLDER]
    
    print("📬 Getting messages...")
    messages = inbox.Items
    print(f"📊 Found {messages.Count} total messages in inbox")
    
    print("🔄 Sorting messages by date...")
    messages.Sort("[ReceivedTime]", True)

    print("🔗 Getting database prerequisites...")
    # Get database prerequisites
    user_id = get_user_id()
    category_id = get_category_id('VIPs')
    
    processed_count = 0
    new_reports = 0
    new_versions = 0

    print(f"✅ Starting email processing...")
    print(f"   User ID: {user_id}")
    print(f"   Category ID: {category_id}")
    print(f"   Looking for keywords: {KEYWORDS}")
    print("---")

    email_count = 0
    for message in messages:
        email_count += 1
        if email_count % 50 == 0:  # Progress indicator every 50 emails
            print(f"   📬 Processed {email_count} emails so far...")
        
        try:
            subject = str(message.Subject)
            if all(kw in subject for kw in KEYWORDS) and message.Attachments.Count > 0:
                print(f"🎯 Found matching email: '{subject[:60]}...' with {message.Attachments.Count} attachments")
                upload_date = message.ReceivedTime.strftime("%Y-%m-%d")  # Format as yyyy-mm-dd

                for i in range(1, message.Attachments.Count + 1):
                    print(f"   📎 Processing attachment {i}/{message.Attachments.Count}")
                    attachment = message.Attachments.Item(i)
                    file_name = attachment.FileName
                    ext = os.path.splitext(file_name)[-1].lower()
                    
                    print(f"      File: {file_name} (type: {ext})")

                    if ext not in ALLOWED_EXTENSIONS or ext in EXCLUDED_EXTENSIONS:
                        print(f"      ⏭️  Skipping {file_name} - not an allowed file type")
                        continue

                    file_size_kb = round(attachment.Size / 1024, 2)
                    print(f"      📁 Processing: {file_name} ({file_size_kb} KB)")

                    # Save to temp file
                    local_file_path = os.path.join(os.getcwd(), f"temp_{file_name}")
                    print(f"      💾 Saving to temp file: {local_file_path}")
                    attachment.SaveAsFile(local_file_path)

                    try:
                        # Upload to OneDrive and get shareable link
                        print(f"      ☁️  Uploading to OneDrive...")
                        file_id = upload_to_onedrive(local_file_path, access_token)
                        print(f"      🔗 Getting share link...")
                        share_url = get_onedrive_share_link(file_id, access_token)

                        # Detect frequency
                        freq = 'weekly'  # Default for VIP reports
                        for f in ['daily', 'weekly', 'monthly', 'quarterly']:
                            if f in subject.lower() or f in file_name.lower():
                                freq = f
                                break

                        # Extract base report name for grouping
                        base_report_name = extract_base_report_name(file_name)
                        
                        # Prepare report data
                        report_data = {
                            'subject': subject,
                            'report_name': base_report_name,  # Use base name for grouping
                            'report_description': f'Auto-imported from email: {subject}',
                            'frequency': freq,
                            'onedrive_url': share_url,
                            'file_name': file_name,  # Keep full filename for version tracking
                            'file_size': f"{file_size_kb} KB",
                            'file_type': ext.lstrip('.'),
                            'upload_date': upload_date,
                            'is_hidden': 0,
                            'is_from_home_office': 1,
                            'priority': 0,
                            'tags': [],  # Empty JSON array instead of empty string
                            'metadata': []  # Empty JSON array instead of empty string
                        }
                        
                        print(f"      📋 Base name: '{base_report_name}' | Full name: '{file_name}'")

                        # Check if report already exists
                        print(f"      🔍 Checking for existing report...")
                        existing_report_id = check_existing_report(file_name, category_id)
                        
                        if existing_report_id:
                            # Create new version
                            print(f"      📝 Creating new version for existing report...")
                            version_id = create_report_version(existing_report_id, report_data, user_id)
                            print(f"      ✅ Added as version to existing report ID: {existing_report_id} (Version ID: {version_id})")
                            new_versions += 1
                        else:
                            # Create new report
                            print(f"      📝 Creating new report...")
                            report_id = create_new_report(report_data, user_id, category_id)
                            print(f"      ✅ Created new report ID: {report_id}")
                            new_reports += 1

                        processed_count += 1

                    finally:
                        # Clean up temp file
                        if os.path.exists(local_file_path):
                            os.remove(local_file_path)

        except Exception as e:
            print(f"❌ Error processing message: {e}")
            if 'subject' in locals():
                print(f"   Subject was: '{subject[:60]}...'")
            continue

    print(f"\n📊 Email processing completed!")
    print(f"   📬 Total emails scanned: {email_count}")
    print(f"   🎯 Matching emails found: {processed_count}")
    return processed_count, new_reports, new_versions

# === Main ===
if __name__ == "__main__":
    print("🔐 Authenticating with Microsoft Graph...")
    token = get_graph_token()
    
    print("\n📧 Processing emails and uploading to database...")
    processed, new_reports, new_versions = process_emails_to_database(token)
    
    print("\n" + "="*50)
    print("📊 PROCESSING COMPLETE")
    print("="*50)
    print(f"✅ Total files processed: {processed}")
    print(f"📝 New reports created: {new_reports}")
    print(f"🔄 New versions added: {new_versions}")
    print("="*50) 