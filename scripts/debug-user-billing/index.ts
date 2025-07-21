import { command, option, string as stringType, optional } from 'cmd-ts';
import { Autumn } from 'autumn-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { user } from '../../apps/server/src/db/schema';
import postgres from 'postgres';

const debugUserBillingCommand = command({
  name: 'debug-user-billing',
  description: 'Debug user billing information to see what products are attached in Autumn',
  args: {
    databaseUrl: option({
      type: stringType,
      long: 'database-url',
      short: 'd',
      env: 'DATABASE_URL',
      description: 'PostgreSQL database connection string',
    }),
    autumnSecretKey: option({
      type: stringType,
      long: 'autumn-secret',
      short: 'a',
      env: 'AUTUMN_SECRET_KEY',
      description: 'Autumn secret key for API access',
    }),
    userEmail: option({
      type: optional(stringType),
      long: 'user-email',
      short: 'e',
      description: 'Email of the user to debug (optional, will use first user if not provided)',
    }),
  },
  handler: async (args: {
    databaseUrl: string;
    autumnSecretKey: string;
    userEmail?: string;
  }) => {
    const { databaseUrl, autumnSecretKey, userEmail } = args;

    if (!databaseUrl) {
      console.error('❌ Database URL is required. Use --database-url or set DATABASE_URL environment variable');
      process.exit(1);
    }

    if (!autumnSecretKey) {
      console.error('❌ Autumn secret key is required. Use --autumn-secret or set AUTUMN_SECRET_KEY environment variable');
      process.exit(1);
    }

    try {
      // Initialize database connection
      const client = postgres(databaseUrl);
      const db = drizzle(client);

      // Initialize Autumn
      const autumn = new Autumn({ secretKey: autumnSecretKey });

      // Fetch user
      console.log('📊 Fetching user from database...');
      let targetUser;
      
      if (userEmail) {
        const users = await db.select().from(user).where(eq(user.email, userEmail));
        targetUser = users[0];
        if (!targetUser) {
          console.error(`❌ User with email ${userEmail} not found`);
          await client.end();
          return;
        }
      } else {
        const users = await db.select().from(user).limit(1);
        targetUser = users[0];
        if (!targetUser) {
          console.error('❌ No users found in database');
          await client.end();
          return;
        }
      }

      console.log(`📈 Found user: ${targetUser.email} (${targetUser.id})`);

      // Fetch customer data from Autumn
      console.log('\n🔍 Fetching customer data from Autumn...');
      
      try {
        const customer = await autumn.customers.get(targetUser.id);
        
        if (!customer.data) {
          console.error('❌ No customer data returned from Autumn');
          await client.end();
          return;
        }
        
        console.log('\n📋 Customer Data:');
        console.log('Customer ID:', customer.data.id);
        console.log('Customer Email:', customer.data.email);
        console.log('Customer Name:', customer.data.name);
        
        console.log('\n🛍️  Products:');
        if (customer.data.products && Array.isArray(customer.data.products)) {
          if (customer.data.products.length === 0) {
            console.log('   ❌ No products found');
          } else {
            customer.data.products.forEach((product: any, index: number) => {
              console.log(`   ${index + 1}. Product ID: ${product.id || 'N/A'}`);
              console.log(`      Product Name: ${product.name || 'N/A'}`);
              console.log(`      Status: ${product.status || 'N/A'}`);
              console.log(`      Created: ${product.created_at || 'N/A'}`);
              console.log('');
            });
          }
        } else {
          console.log('   ❌ Products field is missing or not an array');
        }

        console.log('\n🎯 Features:');
        if (customer.data.features) {
          Object.entries(customer.data.features).forEach(([key, feature]: [string, any]) => {
            console.log(`   ${key}:`);
            console.log(`      Balance: ${feature.balance || 'N/A'}`);
            console.log(`      Unlimited: ${feature.unlimited || false}`);
            console.log(`      Usage: ${feature.usage || 0}`);
            console.log('');
          });
        } else {
          console.log('   ❌ No features found');
        }

        // Check if user would be considered "pro" based on the useBilling logic
        console.log('\n🔍 Pro Status Analysis:');
        const PRO_PLANS = ['pro-example', 'pro_annual', 'team', 'enterprise'];
        
        if (!customer.data.products || !Array.isArray(customer.data.products)) {
          console.log('   ❌ Cannot determine pro status: no products array');
        } else {
          const isPro = customer.data.products.some((product: any) =>
            PRO_PLANS.some((plan) => product.id?.includes(plan) || product.name?.includes(plan))
          );
          
          console.log(`   Pro Status: ${isPro ? '✅ PRO' : '❌ NOT PRO'}`);
          
          if (!isPro && customer.data.products.length > 0) {
            console.log('\n   🔍 Why not pro? Checking each product:');
            customer.data.products.forEach((product: any, index: number) => {
              const matchesPlan = PRO_PLANS.some((plan) => product.id?.includes(plan) || product.name?.includes(plan));
              console.log(`   ${index + 1}. Product ID "${product.id}" | Name "${product.name}" | Matches Pro Plan: ${matchesPlan}`);
              if (!matchesPlan) {
                console.log(`      - Checked against: ${PRO_PLANS.join(', ')}`);
              }
            });
          }
        }

      } catch (autumnError: any) {
        console.error('❌ Error fetching customer from Autumn:', autumnError.message);
        console.log('\n🔍 This could mean:');
        console.log('   1. The customer doesn\'t exist in Autumn yet');
        console.log('   2. There\'s an authentication issue with your Autumn secret key');
        console.log('   3. There\'s a network/API issue');
      }

      await client.end();

    } catch (error: any) {
      console.error('❌ Script failed:', error.message);
      process.exit(1);
    }
  },
});

export { debugUserBillingCommand }; 