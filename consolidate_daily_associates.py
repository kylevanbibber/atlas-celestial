import mysql.connector
import json
import re
from datetime import datetime

# === Database Configuration ===
DB_CONFIG = {
    'host': '208.109.78.44',
    'user': 'kvanbibber',
    'password': 'Atlas2024!',
    'database': 'AriasLifeUsers',
    'charset': 'utf8mb4'
}

def get_db_connection():
    """Create and return a database connection"""
    return mysql.connector.connect(**DB_CONFIG)

def extract_base_report_name(file_name):
    """Extract the base report name without date patterns"""
    # Remove file extension
    name_without_ext = file_name.replace('.xlsx', '').replace('.xls', '').replace('.csv', '')
    
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
    
    # Clean up any trailing spaces
    base_name = base_name.strip()
    
    return base_name

def find_and_delete_dlabik_reports():
    """Find and delete all reports with 'Dlabik' in the name"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Find all Dlabik reports
        cursor.execute("""
            SELECT id, report_name, file_name 
            FROM onedrive_reports 
            WHERE report_name LIKE '%Dlabik%' OR file_name LIKE '%Dlabik%'
        """)
        
        dlabik_reports = cursor.fetchall()
        
        if not dlabik_reports:
            print("✅ No Dlabik reports found to delete.")
            return 0
        
        print(f"🗑️  Found {len(dlabik_reports)} Dlabik reports to delete:")
        for report_id, report_name, file_name in dlabik_reports:
            print(f"   📄 ID {report_id}: {file_name or report_name}")
        
        # Ask for confirmation
        response = input(f"\n❓ Do you want to delete these {len(dlabik_reports)} Dlabik reports? (y/N): ")
        if response.lower() != 'y':
            print("❌ Dlabik deletion cancelled.")
            return 0
        
        # Delete the reports
        dlabik_ids = [str(report[0]) for report in dlabik_reports]
        placeholders = ','.join(['%s'] * len(dlabik_ids))
        cursor.execute(f"DELETE FROM onedrive_reports WHERE id IN ({placeholders})", dlabik_ids)
        
        conn.commit()
        
        print(f"✅ Deleted {len(dlabik_reports)} Dlabik reports successfully!")
        return len(dlabik_reports)
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Error deleting Dlabik reports: {e}")
        return 0
        
    finally:
        cursor.close()
        conn.close()

def find_duplicate_reports():
    """Find all reports that should be grouped together"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Get all reports and group them by base name
        cursor.execute("""
            SELECT id, report_name, file_name, onedrive_url, file_size, upload_date, 
                   subject, added_at, created_by, updated_by
            FROM onedrive_reports 
            ORDER BY added_at ASC
        """)
        
        all_reports = cursor.fetchall()
        
        # Group reports by base name
        grouped_reports = {}
        
        for report in all_reports:
            report_id, report_name, file_name, onedrive_url, file_size, upload_date, subject, added_at, created_by, updated_by = report
            
            # Extract base name from either report_name or file_name
            base_name = extract_base_report_name(file_name or report_name)
            
            if base_name not in grouped_reports:
                grouped_reports[base_name] = []
                
            grouped_reports[base_name].append({
                'id': report_id,
                'report_name': report_name,
                'file_name': file_name,
                'onedrive_url': onedrive_url,
                'file_size': file_size,
                'upload_date': upload_date,
                'subject': subject,
                'added_at': added_at,
                'created_by': created_by,
                'updated_by': updated_by
            })
        
        # Find groups with multiple reports (duplicates)
        duplicates = {base_name: reports for base_name, reports in grouped_reports.items() if len(reports) > 1}
        
        return duplicates
        
    finally:
        cursor.close()
        conn.close()

def consolidate_report_group(base_name, reports):
    """Consolidate a group of duplicate reports into one main report with versions"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        print(f"\n📋 Consolidating '{base_name}' ({len(reports)} duplicates)")
        
        # Sort reports by upload_date (or added_at if upload_date is null), oldest first
        reports_sorted = sorted(reports, key=lambda x: x['upload_date'] or x['added_at'] or datetime.min)
        
        # Keep the first (oldest) report as the main report
        main_report = reports_sorted[0]
        duplicate_reports = reports_sorted[1:]
        
        print(f"   🎯 Main report ID: {main_report['id']} (keeping this one)")
        
        # Update the main report's name to use the base name
        cursor.execute("""
            UPDATE onedrive_reports 
            SET report_name = %s, updated_at = NOW()
            WHERE id = %s
        """, (base_name, main_report['id']))
        
        versions_created = 0
        
        # Convert each duplicate into a version
        for i, duplicate in enumerate(duplicate_reports):
            # Create version name from the date or sequence
            if duplicate['upload_date']:
                version_name = f"Version {duplicate['upload_date']}"
            else:
                version_name = f"Version {duplicate['added_at'].strftime('%Y-%m-%d')}"
            
            version_notes = f"Consolidated from duplicate report ID {duplicate['id']}: {duplicate['subject'] or 'No notes'}"
            
            # Insert into report_versions
            cursor.execute("""
                INSERT INTO report_versions (
                    report_id, version_name, file_name, onedrive_url, file_size,
                    upload_date, is_current, version_notes, created_by, created_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW()
                )
            """, (
                main_report['id'],
                version_name,
                duplicate['file_name'],
                duplicate['onedrive_url'],
                duplicate['file_size'],
                duplicate['upload_date'],
                False,  # Not current version
                version_notes,
                duplicate['created_by']
            ))
            
            versions_created += 1
            print(f"   ✅ Created version from report ID {duplicate['id']}")
        
        # Delete the duplicate reports from onedrive_reports
        duplicate_ids = [str(dup['id']) for dup in duplicate_reports]
        if duplicate_ids:
            placeholders = ','.join(['%s'] * len(duplicate_ids))
            cursor.execute(f"DELETE FROM onedrive_reports WHERE id IN ({placeholders})", duplicate_ids)
            print(f"   🗑️  Deleted {len(duplicate_ids)} duplicate reports")
        
        conn.commit()
        
        return versions_created, len(duplicate_ids)
        
    except Exception as e:
        conn.rollback()
        print(f"   ❌ Error consolidating {base_name}: {e}")
        return 0, 0
        
    finally:
        cursor.close()
        conn.close()

def main():
    print("🚀 Starting Report Cleanup and Consolidation")
    print("="*50)
    
    # Step 1: Delete Dlabik reports
    print("\n🗑️  STEP 1: Removing Dlabik Reports")
    dlabik_deleted = find_and_delete_dlabik_reports()
    
    # Step 2: Find and consolidate duplicates
    print("\n🔍 STEP 2: Finding duplicate reports...")
    duplicates = find_duplicate_reports()
    
    if not duplicates:
        print("✅ No duplicate reports found!")
        if dlabik_deleted > 0:
            print(f"✅ Cleanup complete! Deleted {dlabik_deleted} Dlabik reports.")
        return
    
    print(f"📊 Found {len(duplicates)} report groups with duplicates:")
    for base_name, reports in duplicates.items():
        print(f"   📂 '{base_name}': {len(reports)} duplicates")
    
    total_versions_created = 0
    total_duplicates_removed = 0
    
    # Ask for confirmation
    response = input(f"\n❓ Do you want to consolidate these {len(duplicates)} report groups? (y/N): ")
    if response.lower() != 'y':
        print("❌ Consolidation cancelled.")
        return
    
    print("\n🔄 Starting consolidation...")
    
    for base_name, reports in duplicates.items():
        versions_created, duplicates_removed = consolidate_report_group(base_name, reports)
        total_versions_created += versions_created
        total_duplicates_removed += duplicates_removed
    
    print("\n" + "="*60)
    print("📊 CLEANUP & CONSOLIDATION COMPLETE")
    print("="*60)
    print(f"🗑️  Dlabik reports deleted: {dlabik_deleted}")
    print(f"✅ Report groups processed: {len(duplicates)}")
    print(f"🔄 Versions created: {total_versions_created}")
    print(f"🗑️  Duplicate reports removed: {total_duplicates_removed}")
    print("="*60)
    
    # Show summary of remaining reports
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT COUNT(*) FROM onedrive_reports")
        total_reports = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM report_versions")
        total_versions = cursor.fetchone()[0]
        
        print(f"📈 Final database state:")
        print(f"   📝 Total reports: {total_reports}")
        print(f"   🔄 Total versions: {total_versions}")
        
    finally:
        cursor.close()
        conn.close()

def test_base_name_extraction():
    """Test the base name extraction on some sample Weekly Agent Count reports"""
    test_files = [
        "Weekly Agent Count 04-04-25 - Arias.xlsx",
        "Weekly Agent Count 03-28-25 - Arias.xlsx", 
        "Weekly Agent Count 07-12-24 - Arias-Dlabik.xlsx",
        "Weekly Agent Count 08-02-24 - Arias 08022024).xlsx",
        "Weekly Agent Count YTD - Arias.xlsx",
        "Daily New Associates Report 07-15-2024.xlsx"
    ]
    
    print("🧪 Testing base name extraction:")
    for file_name in test_files:
        base_name = extract_base_report_name(file_name)
        print(f"   '{file_name}' → '{base_name}'")

if __name__ == "__main__":
    # Uncomment the next line to test base name extraction
    # test_base_name_extraction()
    main() 