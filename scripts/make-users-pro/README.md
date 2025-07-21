# Make Users Pro Script

This script makes all users in your database pro by attaching pro products to their Autumn customer records.

## How it works

1. **Fetches all users** from your PostgreSQL database
2. **Creates Autumn customers** for each user (if they don't exist)
3. **Attaches a pro product** (default: `pro-example`) to each user's Autumn customer
4. **Reports progress** and shows a summary of successful/failed operations

## Usage

### Basic usage (with environment variables)

Make sure you have these environment variables set in your `.env` file:
- `DATABASE_URL` - Your PostgreSQL connection string
- `AUTUMN_SECRET_KEY` - Your Autumn API secret key

```bash
# From the root of the project
pnpm run script make-users-pro

# With confirmation prompt
pnpm run script make-users-pro --skip-confirmation
```

### Advanced usage (with command line options)

```bash
# Dry run (see what would happen without making changes)
pnpm run script make-users-pro --dry-run

# Use a different product ID
pnpm run script make-users-pro --product-id "pro_annual"

# Skip confirmation prompt
pnpm run script make-users-pro --skip-confirmation

# Use specific database URL and Autumn key
pnpm run script make-users-pro \
  --database-url "postgresql://user:pass@localhost:5432/db" \
  --autumn-secret "your_autumn_secret_key"
```

## Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--database-url` | `-d` | PostgreSQL connection string | `$DATABASE_URL` |
| `--autumn-secret` | `-a` | Autumn API secret key | `$AUTUMN_SECRET_KEY` |
| `--product-id` | `-p` | Product ID to attach to users | `pro-example` |
| `--dry-run` | | Show what would be done without making changes | `false` |
| `--skip-confirmation` | `-y` | Skip confirmation prompt | `false` |

## Available Product IDs

Based on your `useBilling` hook, these product IDs will make users "pro":
- `pro-example` (default)
- `pro_annual`
- `team`
- `enterprise`

## Safety Features

1. **Dry run mode**: Test the script without making any changes
2. **Confirmation prompt**: Asks for confirmation before proceeding (unless `--skip-confirmation` is used)
3. **Error handling**: Continues processing even if individual users fail
4. **Detailed logging**: Shows progress and reports errors for individual users
5. **Summary report**: Shows total successful and failed operations

## Example Output

```bash
📊 Fetching all users from database...
📈 Found 15 users

📝 Plan:
   - Database: 15 users
   - Product ID: pro-example
   - Dry run: No

? Are you sure you want to make all 15 users pro? › Yes

🚀 Processing users...
   ✅ Attached product to: user1@example.com
   ✅ Attached product to: user2@example.com
   ❌ Failed for user3@example.com: Customer already has this product
   ...

📊 Summary:
   ✅ Successful: 14
   ❌ Failed: 1

💥 Errors:
   - user3@example.com: Customer already has this product

🎉 Successfully made 14 users pro!
```

## Troubleshooting

### Common Issues

1. **Database connection error**: Make sure your `DATABASE_URL` is correct and the database is running
2. **Autumn authentication error**: Verify your `AUTUMN_SECRET_KEY` is valid
3. **Product already attached**: This is usually harmless - it means the user was already pro
4. **Network timeouts**: The script processes users sequentially to avoid rate limits

### Verifying the Results

After running the script, you can verify users are pro by:
1. Checking the Autumn dashboard
2. Testing the `useBilling` hook in your app
3. Looking at the `isPro` property for users

## Security Considerations

- **Run in a safe environment**: Always test with `--dry-run` first
- **Backup your data**: Consider backing up your database before running
- **Limit access**: Only run this script in trusted environments with proper credentials
- **Monitor usage**: Check your Autumn billing for any unexpected charges 