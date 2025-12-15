#!/usr/bin/env ts-node

/**
 * Database management CLI script
 * Usage: npm run db:migrate, npm run db:seed, etc.
 */

import { db, DevelopmentSeeder, initializeDatabase } from '../database';

async function main() {
  const command = process.argv[2];
  
  try {
    switch (command) {
      case 'migrate':
        console.log('Running database migrations...');
        await db.runMigrations();
        console.log('Migrations completed successfully');
        break;
        
      case 'seed':
        console.log('Running database seeds...');
        await DevelopmentSeeder.run();
        console.log('Seeds completed successfully');
        break;
        
      case 'seed:clean':
        console.log('Cleaning seed data...');
        await DevelopmentSeeder.clean();
        console.log('Seed data cleaned successfully');
        break;
        
      case 'init':
        console.log('Initializing database (migrate + seed)...');
        await initializeDatabase(true);
        console.log('Database initialization completed successfully');
        break;
        
      case 'health':
        console.log('Checking database health...');
        const isHealthy = await db.healthCheck();
        if (isHealthy) {
          console.log('✅ Database connection is healthy');
        } else {
          console.log('❌ Database connection failed');
          process.exit(1);
        }
        break;
        
      case 'info':
        const tables = [
          'wallets', 
          'payment_methods', 
          'escrow_transactions', 
          'cart_items', 
          'wishlist_items', 
          'messages', 
          'notifications'
        ];
        
        console.log('Database table information:');
        for (const table of tables) {
          try {
            const info = await db.getTableInfo(table);
            console.log(`\n${table}:`);
            info.forEach(col => {
              console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
            });
          } catch (error) {
            console.log(`  - Table ${table} not found or inaccessible`);
          }
        }
        break;
        
      default:
        console.log(`
Database Management CLI

Usage: npm run db:<command>

Commands:
  migrate     - Run database migrations
  seed        - Run development seeds
  seed:clean  - Clean all seed data
  init        - Initialize database (migrate + seed)
  health      - Check database connection
  info        - Show table information

Examples:
  npm run db:migrate
  npm run db:seed
  npm run db:init
        `);
        break;
    }
  } catch (error) {
    console.error('Database operation failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export default main;