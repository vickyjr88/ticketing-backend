const { DataSource } = require('typeorm');

const ds = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
});

ds.initialize().then(async () => {
  console.log('🗑️  Cleaning data...');
  
  await ds.query('DELETE FROM tickets');
  console.log('✅ Tickets deleted');
  
  await ds.query('DELETE FROM orders'); 
  console.log('✅ Orders deleted');
  
  await ds.query('DELETE FROM lottery_entries');
  console.log('✅ Lottery entries deleted');
  
  console.log('🎉 Data cleaned successfully');
  process.exit(0);
}).catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
