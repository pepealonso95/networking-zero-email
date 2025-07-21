import { command, flag, option, string as stringType, boolean as booleanType } from 'cmd-ts';
import { confirm } from '@inquirer/prompts';
import { Autumn } from 'autumn-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import { user } from '../../apps/server/src/db/schema';
import postgres from 'postgres';

const makeUsersProCommand = command({
  name: 'make-users-pro',
  description: 'Make all users in the database pro by attaching pro products to their Autumn customers',
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
    productId: option({
      type: stringType,
      long: 'product-id',
      short: 'p',
      defaultValue: () => 'pro-example',
      description: 'Product ID to attach to users (default: pro-example)',
    }),
    dryRun: flag({
      type: booleanType,
      long: 'dry-run',
      description: 'Show what would be done without making actual changes',
    }),
    skipConfirmation: flag({
      type: booleanType,
      long: 'skip-confirmation',
      short: 'y',
      description: 'Skip confirmation prompt',
    }),
  },
  handler: async (args: {
    databaseUrl: string;
    autumnSecretKey: string;
    productId: string;
    dryRun: boolean;
    skipConfirmation: boolean;
  }) => {
    const { databaseUrl, autumnSecretKey, productId, dryRun, skipConfirmation } = args;

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

      // Fetch all users
      console.log('📊 Fetching all users from database...');
      const users = await db.select().from(user);
      console.log(`📈 Found ${users.length} users`);

      if (users.length === 0) {
        console.log('✅ No users found in database');
        await client.end();
        return;
      }

      // Show what will be done
      console.log(`\n📝 Plan:`);
      console.log(`   - Database: ${users.length} users`);
      console.log(`   - Product ID: ${productId}`);
      console.log(`   - Dry run: ${dryRun ? 'Yes' : 'No'}`);

      if (!skipConfirmation && !dryRun) {
        const confirmed = await confirm({
          message: `Are you sure you want to make all ${users.length} users pro?`,
        });

        if (!confirmed) {
          console.log('❌ Operation cancelled');
          await client.end();
          return;
        }
      }

      // Process users
      let successCount = 0;
      let errorCount = 0;
      const errors: { userId: string; email: string; error: string }[] = [];

      console.log(`\n🚀 ${dryRun ? 'Simulating' : 'Processing'} users...`);

      for (const currentUser of users) {
        try {
          if (dryRun) {
            console.log(`   [DRY RUN] Would attach product "${productId}" to user: ${currentUser.email} (${currentUser.id})`);
          } else {
            // First, ensure the customer exists in Autumn
            try {
              await autumn.customers.create({
                id: currentUser.id,
                name: currentUser.name,
                email: currentUser.email,
              });
            } catch (createError: any) {
              // Customer might already exist, which is fine
              if (!createError?.message?.includes('already exists')) {
                console.log(`   ⚠️  Warning: Could not create customer for ${currentUser.email}: ${createError.message}`);
              }
            }

            // Attach the pro product
            console.log(`   🔄 Attempting to attach product "${productId}" to ${currentUser.email}...`);
            const attachResult = await autumn.attach({
              product_id: productId,
              customer_id: currentUser.id,
              customer_data: {
                name: currentUser.name,
                email: currentUser.email,
              },
            } as any);

            console.log(`   📄 Attach result:`, JSON.stringify(attachResult, null, 2));

            if (!attachResult || !attachResult.data) {
              throw new Error(`Attach operation failed. Result: ${JSON.stringify(attachResult)}`);
            }

            console.log(`   ✅ Attached product to: ${currentUser.email}`);
          }
          successCount++;
        } catch (error: any) {
          errorCount++;
          const errorMessage = error.message || 'Unknown error';
          errors.push({
            userId: currentUser.id,
            email: currentUser.email,
            error: errorMessage,
          });
          console.log(`   ❌ Failed for ${currentUser.email}: ${errorMessage}`);
        }
      }

      // Summary
      console.log(`\n📊 Summary:`);
      console.log(`   ✅ Successful: ${successCount}`);
      console.log(`   ❌ Failed: ${errorCount}`);

      if (errors.length > 0) {
        console.log(`\n💥 Errors:`);
        errors.forEach(({ email, error }) => {
          console.log(`   - ${email}: ${error}`);
        });
      }

      if (!dryRun && successCount > 0) {
        console.log(`\n🎉 Successfully made ${successCount} users pro!`);
      }

      await client.end();

    } catch (error: any) {
      console.error('❌ Script failed:', error.message);
      process.exit(1);
    }
  },
});

export { makeUsersProCommand }; 