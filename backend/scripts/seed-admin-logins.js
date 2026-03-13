// Script to seed the admin_logins table with the provided data
const { query } = require('../db');

const adminUsers = [
  {
    Username: 'kvanbibber',
    Password: 'kyle',
    Email: 'kylevanbib@gmail.com',
    Screen_Name: 'Kyle VanBibber',
    Admin_Level: 'Admin',
    Agency: 'Arias',
    teamRole: 'app'
  },
  {
    Username: 'cwilliams',
    Password: 'Arias123!',
    Email: 'cwilliams@ariasagencies.com',
    Screen_Name: 'Chris Williams',
    Admin_Level: 'Admin',
    Agency: 'Arias',
    teamRole: 'app'
  },
  {
    Username: 'jpride',
    Password: 'Arias456!',
    Email: 'jpride@ariasagencies.com',
    Screen_Name: 'Jackie Pride',
    Admin_Level: 'Admin',
    Agency: 'Arias',
    teamRole: 'app'
  },
  {
    Username: 'hhunter',
    Password: 'Hunter123!',
    Email: 'hhunter@ariasagencies.com',
    Screen_Name: 'Harriet Hunter',
    Admin_Level: 'Admin',
    Agency: 'Arias',
    teamRole: 'app'
  },
  {
    Username: 'gkramer',
    Password: 'Kramer123!',
    Email: 'gkramer@ariasagencies.com',
    Screen_Name: 'Gina Kramer',
    Admin_Level: 'Admin',
    Agency: 'Arias',
    teamRole: 'app'
  },
  {
    Username: 'mobringer',
    Password: 'Obringer123!',
    Email: 'mobringer@ariasagenices.com',
    Screen_Name: 'Matt Obringer',
    Admin_Level: 'Admin',
    Agency: 'Arias',
    teamRole: 'app'
  },
  {
    Username: 'jriley',
    Password: 'Riley123!',
    Email: 'jriley@ariasagencies.com',
    Screen_Name: 'Jimmy Riley',
    Admin_Level: 'Admin',
    Agency: 'Arias',
    teamRole: 'app'
  },
  {
    Username: 'mrisdon',
    Password: 'Risdon123!',
    Email: 'mrisdon@ariasagencies.com',
    Screen_Name: 'Maureen Risdon',
    Admin_Level: 'Admin',
    Agency: 'Arias',
    teamRole: 'app'
  },
  {
    Username: 'shochreiter',
    Password: 'Hochreiter123!',
    Email: 'srhinehart@ariasagencies.com',
    Screen_Name: 'Sarah Hochreiter',
    Admin_Level: 'Admin',
    Agency: 'Arias',
    teamRole: 'app'
  },
  {
    Username: 'ajones',
    Password: 'Jones123!',
    Email: 'ajones@ariasagencies.com',
    Screen_Name: 'Ariana Jones',
    Admin_Level: 'Admin',
    Agency: 'Arias',
    teamRole: 'app'
  },
  {
    Username: 'anieman',
    Password: 'Diamond123!',
    Email: 'anieman@ariasagencies.com',
    Screen_Name: 'Alicia Nieman',
    Admin_Level: 'Admin',
    Agency: 'Arias',
    teamRole: 'app'
  },
  {
    Username: 'jshulte',
    Password: 'Shulte123!',
    Email: null,
    Screen_Name: null,
    Admin_Level: 'Admin',
    Agency: 'Florida',
    teamRole: 'app'
  },
  {
    Username: 'nurso',
    Password: null,
    Email: 'nicholas.urso@ariasagencies.com',
    Screen_Name: 'Nick Urso',
    Admin_Level: 'LEVEL_3',
    Agency: 'Arias',
    teamRole: 'app'
  },
  {
    Username: 'bdesrosiers',
    Password: null,
    Email: 'blue@ailcfl.com',
    Screen_Name: 'Blue Desrosiers',
    Admin_Level: 'Admin',
    Agency: 'Arias',
    teamRole: 'app'
  },
  {
    Username: 'rtaggart',
    Password: 'Taggart1!',
    Email: 'rtaggart@ariasagencies.com',
    Screen_Name: 'Ross Taggart',
    Admin_Level: 'Admin',
    Agency: 'Arias',
    teamRole: 'leads'
  },
  {
    Username: 'pyaple',
    Password: 'Yaple1!',
    Email: 'pyaple@ariasagencies.com',
    Screen_Name: 'Peter Yaple',
    Admin_Level: 'Admin',
    Agency: 'Arias',
    teamRole: 'leads'
  },
  {
    Username: 'jlageman',
    Password: 'Lageman1!',
    Email: 'jlageman@ariasagencies.com',
    Screen_Name: 'Josh Lageman',
    Admin_Level: 'Admin',
    Agency: 'Arias',
    teamRole: 'leads'
  },
  {
    Username: 'jgonzalez',
    Password: 'Gonzalez1!',
    Email: 'jgonazlez@ariasagencies.com',
    Screen_Name: 'Joevanny Gonzalez',
    Admin_Level: 'Admin',
    Agency: 'Arias',
    teamRole: 'leads'
  },
  {
    Username: 'aochman',
    Password: 'Ochman1!',
    Email: 'aochman@ariasagencies.com',
    Screen_Name: 'Alejandra Ochman',
    Admin_Level: 'Admin',
    Agency: 'Arias',
    teamRole: 'app'
  },
  {
    Username: 'jbratin',
    Password: 'Bratin1!',
    Email: 'jbratin@ariasagencies.com',
    Screen_Name: 'Jason Bratin',
    Admin_Level: 'Admin',
    Agency: 'Arias',
    teamRole: 'app'
  },
  {
    Username: 'ynelson',
    Password: 'Nelson1!',
    Email: 'ynelsonail@gmail.com',
    Screen_Name: 'Yvette Nelson',
    Admin_Level: 'Admin',
    Agency: 'Arias',
    teamRole: 'app'
  },
  {
    Username: 'ameyer',
    Password: 'Meyer123!',
    Email: 'ameyer@ariasagencies.com',
    Screen_Name: 'Ashley Meyer',
    Admin_Level: 'Admin',
    Agency: 'Arias',
    teamRole: 'app'
  }
];

async function seedAdminLogins() {
  try {
    console.log('Starting admin_logins table seeding...');

    // First, check if table exists
    const tableExists = await query("SHOW TABLES LIKE 'admin_logins'");
    if (tableExists.length === 0) {
      console.error('admin_logins table does not exist. Please run the migration first.');
      process.exit(1);
    }

    // Clear existing data
    await query('DELETE FROM admin_logins');
    console.log('Cleared existing admin_logins data');

    // Insert all admin users
    for (const admin of adminUsers) {
      const insertQuery = `
        INSERT INTO admin_logins (Username, Password, Email, Screen_Name, Admin_Level, Agency, teamRole)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      
      await query(insertQuery, [
        admin.Username,
        admin.Password,
        admin.Email,
        admin.Screen_Name,
        admin.Admin_Level,
        admin.Agency,
        admin.teamRole
      ]);
      
      console.log(`✓ Inserted admin user: ${admin.Username} (${admin.Screen_Name})`);
    }

    console.log(`\n✅ Successfully seeded ${adminUsers.length} admin users to admin_logins table`);
    
    // Show the results
    const results = await query('SELECT id, Username, Screen_Name, Admin_Level, Agency, teamRole FROM admin_logins ORDER BY id');
    console.log('\nSeeded admin users:');
    console.table(results);

  } catch (error) {
    console.error('Error seeding admin_logins table:', error);
    process.exit(1);
  }
}

// Run the seeding if this script is called directly
if (require.main === module) {
  seedAdminLogins().then(() => {
    console.log('Seeding completed successfully');
    process.exit(0);
  }).catch(error => {
    console.error('Seeding failed:', error);
    process.exit(1);
  });
}

module.exports = { seedAdminLogins, adminUsers };