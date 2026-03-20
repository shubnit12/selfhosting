import sequelize from './config/database';
import './models';
async function syncDatabase() {
    try {
        console.log('🔄 Syncing database models...\n');

        // Option 1: Drop and recreate (DEVELOPMENT ONLY!)
        // await sequelize.sync({ force: true });
        
        // Option 2: Update existing tables (safer)
        await sequelize.sync({ alter: true });
        
        console.log('✅ Database synced successfully!\n');
        console.log('📊 Tables created/updated:');
        console.log('   ✓ users');
        console.log('   ✓ folders');
        console.log('   ✓ files');
        console.log('   ✓ file_references');
        console.log('   ✓ shared_links');
        console.log('   ✓ activity_logs');
        console.log('\n🎉 Your database is ready!');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Sync failed:', error);
        process.exit(1);
    }
}

syncDatabase();
