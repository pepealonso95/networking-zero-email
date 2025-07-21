import { command, option, string as stringType } from 'cmd-ts';
import { Autumn } from 'autumn-js';

const listAutumnProductsCommand = command({
  name: 'list-autumn-products',
  description: 'List all available products in your Autumn account',
  args: {
    autumnSecretKey: option({
      type: stringType,
      long: 'autumn-secret',
      short: 'a',
      env: 'AUTUMN_SECRET_KEY',
      description: 'Autumn secret key for API access',
    }),
  },
  handler: async (args: {
    autumnSecretKey: string;
  }) => {
    const { autumnSecretKey } = args;

    if (!autumnSecretKey) {
      console.error('❌ Autumn secret key is required. Use --autumn-secret or set AUTUMN_SECRET_KEY environment variable');
      process.exit(1);
    }

    try {
      // Initialize Autumn
      const autumn = new Autumn({ secretKey: autumnSecretKey });

      console.log('🔍 Fetching available products from Autumn...');
      
      try {
        // Try to list products - this API may vary based on the Autumn SDK
        const products = await autumn.products?.list?.() || await (autumn as any).products?.list();
        
        if (!products) {
          console.log('⚠️  Could not fetch products list. This might not be available in the API.');
          console.log('💡 Try creating a product manually in the Autumn dashboard first.');
          return;
        }

        console.log('\n🛍️  Available Products:');
        
        if (products.data && Array.isArray(products.data)) {
          if (products.data.length === 0) {
            console.log('   ❌ No products found in your Autumn account');
            console.log('\n💡 To fix this:');
            console.log('   1. Go to your Autumn dashboard');
            console.log('   2. Create a product with ID "pro-example" or any pro plan ID');
            console.log('   3. Or use an existing product ID that includes: pro-example, pro_annual, team, or enterprise');
          } else {
            products.data.forEach((product: any, index: number) => {
              console.log(`   ${index + 1}. Product ID: ${product.id || 'N/A'}`);
              console.log(`      Name: ${product.name || 'N/A'}`);
              console.log(`      Status: ${product.status || 'N/A'}`);
              console.log(`      Price: ${product.price ? `$${product.price}` : 'N/A'}`);
              console.log('');
            });

            // Check which ones would work for pro status
            console.log('\n🎯 Products that would make users "pro":');
            const PRO_PLANS = ['pro-example', 'pro_annual', 'team', 'enterprise'];
            const proProducts = products.data.filter((product: any) =>
              PRO_PLANS.some((plan) => product.id?.includes(plan) || product.name?.includes(plan))
            );

            if (proProducts.length === 0) {
              console.log('   ❌ No existing products match the pro plan patterns');
              console.log(`   💡 Create a product with one of these IDs: ${PRO_PLANS.join(', ')}`);
            } else {
              proProducts.forEach((product: any, index: number) => {
                console.log(`   ✅ ${index + 1}. ${product.id} (${product.name || 'No name'})`);
              });
            }
          }
        } else {
          console.log('   ⚠️  Unexpected response format:', JSON.stringify(products, null, 2));
        }

      } catch (listError: any) {
        console.error('❌ Error fetching products:', listError.message);
        console.log('\n🔍 This could mean:');
        console.log('   1. The products.list() method is not available in this Autumn SDK version');
        console.log('   2. Your account doesn\'t have permission to list products');
        console.log('   3. The products need to be created manually in the Autumn dashboard');
        
        console.log('\n💡 Solutions:');
        console.log('   1. Go to your Autumn dashboard and create a product with ID "pro-example"');
        console.log('   2. Or check the Autumn documentation for the correct product listing method');
        console.log('   3. Use an existing product ID if you know it');
      }

    } catch (error: any) {
      console.error('❌ Script failed:', error.message);
      process.exit(1);
    }
  },
});

export { listAutumnProductsCommand }; 