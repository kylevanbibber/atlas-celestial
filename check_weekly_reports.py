import mysql.connector
import re

# === Database Configuration ===
DB_CONFIG = {
    'host': '208.109.78.44',
    'user': 'kvanbibber',
    'password': 'Atlas2024!',
    'database': 'atlas',
    'charset': 'utf8mb4'
}

def get_db_connection():
    return mysql.connector.connect(**DB_CONFIG)

def extract_base_report_name(file_name):
    """Extract the base report name without date patterns"""
    # Remove file extension
    name_without_ext = file_name.replace('.xlsx', '').replace('.xls', '').replace('.csv', '')
    
    # Common date patterns to remove
    date_patterns = [
        r'\s*\d{2}-\d{2}-\d{4}$',           # " 07-15-2024" or "07-15-2024"
        r'\s*\d{1,2}-\d{1,2}-\d{4}$',       # " 7-15-2024" or "7-15-2024"
        r'\s*\d{2}-\d{2}-\d{2}$',           # " 07-15-24" or "07-15-24" (2-digit year)
        r'\s*\d{1,2}-\d{1,2}-\d{2}$',       # " 7-15-24" or "7-15-24" (2-digit year)
        r'\s*\d{4}-\d{2}-\d{2}$',           # " 2024-07-15" or "2024-07-15"
        r'\s*\d{2}/\d{2}/\d{4}$',           # " 07/15/2024" or "07/15/2024"
        r'\s*\d{1,2}/\d{1,2}/\d{4}$',       # " 7/15/2024" or "7/15/2024"
        r'\s*\d{2}/\d{2}/\d{2}$',           # " 07/15/24" or "07/15/24" (2-digit year)
        r'\s*\d{1,2}/\d{1,2}/\d{2}$',       # " 7/15/24" or "7/15/24" (2-digit year)
        r'\s*\d{2}\.\d{2}\.\d{4}$',         # " 07.15.2024" or "07.15.2024"
        r'\s+through\s+\d{2}/\d{2}/\d{4}$', # " through 07/15/2024"
        r'\s+\w{3}\s+\d{1,2},?\s+\d{4}$',   # " Jul 15, 2024" or " Jul 15 2024"
        r'\s*\d{8}\)$',                     # " 08022024)" or "08022024)" - special case
    ]
    
    base_name = name_without_ext
    for pattern in date_patterns:
        base_name = re.sub(pattern, '', base_name, flags=re.IGNORECASE)
    
    # Clean up any trailing spaces
    base_name = base_name.strip()
    
    return base_name

def check_weekly_agent_reports():
    """Check all Weekly Agent Count reports in the database"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Get all Weekly Agent Count reports
        cursor.execute("""
            SELECT id, report_name, file_name, upload_date, added_at
            FROM onedrive_reports 
            WHERE report_name LIKE '%Weekly Agent Count%' OR file_name LIKE '%Weekly Agent Count%'
            ORDER BY id
        """)
        
        reports = cursor.fetchall()
        
        print(f"📊 Found {len(reports)} Weekly Agent Count reports in onedrive_reports:")
        print("="*80)
        
        base_name_groups = {}
        
        for report_id, report_name, file_name, upload_date, added_at in reports:
            # Test base name extraction
            test_name = file_name or report_name
            base_name = extract_base_report_name(test_name)
            
            if base_name not in base_name_groups:
                base_name_groups[base_name] = []
            
            base_name_groups[base_name].append({
                'id': report_id,
                'report_name': report_name,
                'file_name': file_name,
                'base_name': base_name
            })
            
            print(f"ID {report_id:3d}: '{report_name}' | File: '{file_name}' | Base: '{base_name}'")
        
        print("\n" + "="*80)
        print("📋 GROUPING ANALYSIS:")
        print("="*80)
        
        for base_name, group_reports in base_name_groups.items():
            print(f"\n📂 Base Name: '{base_name}' ({len(group_reports)} reports)")
            if len(group_reports) > 1:
                print(f"   🔄 This group has {len(group_reports)} duplicates that should be consolidated!")
                for report in group_reports[:3]:  # Show first 3
                    print(f"      - ID {report['id']}: {report['file_name'] or report['report_name']}")
                if len(group_reports) > 3:
                    print(f"      - ... and {len(group_reports) - 3} more")
            else:
                print(f"   ✅ Single report (no duplicates)")
        
        # Check report_versions for Weekly Agent Count
        print("\n" + "="*80)
        print("🔄 CHECKING REPORT_VERSIONS:")
        print("="*80)
        
        cursor.execute("""
            SELECT rv.id, rv.report_id, rv.version_name, rv.file_name, r.report_name
            FROM report_versions rv
            JOIN onedrive_reports r ON rv.report_id = r.id
            WHERE r.report_name LIKE '%Weekly Agent Count%' OR rv.file_name LIKE '%Weekly Agent Count%'
            ORDER BY rv.report_id, rv.id
        """)
        
        versions = cursor.fetchall()
        
        if versions:
            print(f"Found {len(versions)} versions:")
            for version_id, report_id, version_name, file_name, report_name in versions:
                print(f"   Version ID {version_id}: Report {report_id} ('{report_name}') - {file_name}")
        else:
            print("❌ No versions found for Weekly Agent Count reports")
        
        return base_name_groups
        
    finally:
        cursor.close()
        conn.close()

def test_specific_patterns():
    """Test the pattern matching on actual filenames from the database"""
    print("\n" + "="*80)
    print("🧪 TESTING PATTERN EXTRACTION:")
    print("="*80)
    
    # Test some sample names that are probably in the database
    test_names = [
        "Weekly Agent Count 04-04-25 - Arias",
        "Weekly Agent Count 3-28-25 - Arias", 
        "Weekly Agent Count 12/26/24 - Arias",
        "Weekly Agent Count 1/17/25 - Arias",
        "Weekly Agent Count YTD - Arias",
        "Weekly Agent Count 08-02-24 - Arias 08022024)",
        "Daily New Associates Report 07-15-2024",
    ]
    
    for name in test_names:
        base = extract_base_report_name(name)
        print(f"   '{name}' → '{base}'")

if __name__ == "__main__":
    print("🔍 WEEKLY AGENT COUNT REPORT DIAGNOSTIC")
    print("="*50)
    
    # Test pattern extraction first
    test_specific_patterns()
    
    # Then check actual database
    base_name_groups = check_weekly_agent_reports()
    
    # Summary
    duplicate_groups = {name: reports for name, reports in base_name_groups.items() if len(reports) > 1}
    
    print("\n" + "="*80)
    print("📊 SUMMARY:")
    print("="*80)
    print(f"✅ Total unique base names: {len(base_name_groups)}")
    print(f"🔄 Groups with duplicates: {len(duplicate_groups)}")
    
    if duplicate_groups:
        total_duplicates = sum(len(reports) - 1 for reports in duplicate_groups.values())
        print(f"🗑️  Total reports that could be converted to versions: {total_duplicates}")
        print("\n💡 Next step: Run the consolidation script to fix these duplicates!")
    else:
        print("✅ No duplicates found - all reports are properly consolidated!") 
