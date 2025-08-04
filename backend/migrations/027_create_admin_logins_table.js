// Migration to create admin_logins table
// This table stores admin user credentials and information

exports.up = function(knex) {
  return knex.schema.createTable('admin_logins', function(table) {
    table.increments('id').primary();
    table.string('Username', 255).notNullable().unique();
    table.string('Password', 255).nullable(); // Stored as plain text as per requirements
    table.string('Email', 255).nullable();
    table.string('Screen_Name', 255).nullable();
    table.string('Admin_Level', 50).nullable();
    table.string('Agency', 255).nullable();
    table.string('teamRole', 100).nullable();
    table.timestamps(true, true); // created_at and updated_at
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('admin_logins');
};