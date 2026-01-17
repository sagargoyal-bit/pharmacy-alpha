# Expired Medicine Cleanup Cron Job

Automated cleanup script that deletes expired medicine purchase history and stock transactions that are 2+ years old.

## Overview

This cron job runs annually on **January 1st at 12:00 PM** to clean up old expired medicine records from the database. It helps maintain database performance and removes historical data that is no longer needed.

### What Gets Deleted

The script deletes expired medicine batches based on the retention period (default: **2 years**). For example:
- If today is **January 1, 2026** and retention is 2 years, it will delete medicines that expired before **January 1, 2024**
- If today is **January 1, 2027** and retention is 2 years, it will delete medicines that expired before **January 1, 2025**
- You can configure the retention period using the `CLEANUP_RETENTION_YEARS` environment variable

### Database Tables Affected

The script cleans up the following tables (in order):

1. **`expiry_alerts`** - Expiry alert records for the batch
2. **`current_inventory`** - Current stock levels for the batch
3. **`stock_transactions`** - All stock movement history for the batch
4. **`purchase_items`** - Individual medicine purchase records
5. **`purchases`** - Parent purchase records (only if all items are deleted)

## Installation

### 1. Navigate to the cron directory

```bash
cd pharmacyPlus/cron
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example environment file and fill in your Supabase credentials:

```bash
cp env.example .env
```

Edit `.env` and add your Supabase credentials:

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
DRY_RUN=false
CLEANUP_RETENTION_YEARS=2
VERBOSE=true
```

> ⚠️ **Important**: Use the **Service Role Key**, not the anon key. The service role key bypasses Row Level Security (RLS) policies, which is necessary for this admin operation.

## Usage

### Development & Testing

#### Dry Run (Preview Only)

Preview what will be deleted without actually deleting anything:

```bash
npm run dry-run
```

Or:

```bash
DRY_RUN=true npm run dev
```

#### Run Manually (Development)

Execute the cleanup script directly using ts-node:

```bash
npm run dev
```

#### Build and Run (Production)

Compile TypeScript to JavaScript and run:

```bash
npm run build
npm start
```

### Command Line Options

You can override environment variables when running:

```bash
# Dry run
DRY_RUN=true npm run dev

# Disable verbose logging
VERBOSE=false npm run dev

# Use different Supabase credentials
SUPABASE_URL=https://other-project.supabase.co npm run dev
```

## Scheduling

### Option 1: Linux/Mac Crontab

Schedule the job to run annually on January 1st at 12:00 PM:

```bash
# Edit crontab
crontab -e

# Add this line (adjust paths as needed)
0 12 1 1 * cd /path/to/pharmacyPlus/cron && /usr/local/bin/node dist/cleanup-expired-medicines.js >> /var/log/pharmacy-cleanup.log 2>&1
```

Crontab format: `minute hour day month day_of_week command`
- `0 12 1 1 *` = 12:00 PM on January 1st every year

### Option 2: Windows Task Scheduler

1. Open **Task Scheduler**
2. Create a new **Basic Task**
3. Set trigger to **Yearly** on **January 1st** at **12:00 PM**
4. Set action to **Start a program**
5. Program: `node`
6. Arguments: `dist/cleanup-expired-medicines.js`
7. Start in: `C:\path\to\pharmacyPlus\cron`

### Option 3: GitHub Actions

Create `.github/workflows/cleanup-expired-medicines.yml`:

```yaml
name: Cleanup Expired Medicines

on:
  schedule:
    # Run at 12:00 PM UTC on January 1st every year
    - cron: '0 12 1 1 *'
  workflow_dispatch: # Allow manual trigger

jobs:
  cleanup:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        working-directory: pharmacyPlus/cron
        run: npm install
      
      - name: Run cleanup
        working-directory: pharmacyPlus/cron
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          DRY_RUN: false
          VERBOSE: true
        run: npm run dev
```

Add secrets to your GitHub repository:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Option 4: Vercel Cron

If your app is deployed on Vercel, create an API route and use Vercel Cron:

1. Create `pages/api/cron/cleanup-expired.ts` (wrapper around the cron logic)
2. Add to `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/cron/cleanup-expired",
    "schedule": "0 12 1 1 *"
  }]
}
```

### Option 5: AWS EventBridge

1. Package the script as a Lambda function
2. Create an EventBridge rule with schedule expression: `cron(0 12 1 1 ? *)`
3. Set the Lambda function as the target

## Output & Logging

### Sample Output (Dry Run)

```
[2026-01-01T12:00:00.000Z] ℹ️ ========================================
[2026-01-01T12:00:00.000Z] ℹ️ Expired Medicine Cleanup Job Started
[2026-01-01T12:00:00.000Z] ℹ️ ========================================
[2026-01-01T12:00:00.000Z] ℹ️ Mode: DRY RUN (Preview Only)
[2026-01-01T12:00:00.000Z] ℹ️ Cutoff Date: 2024-01-01
[2026-01-01T12:00:00.000Z] ℹ️ Deleting medicines expired before: 2024-01-01
[2026-01-01T12:00:00.000Z] ℹ️ Fetching expired medicine batches...
[2026-01-01T12:00:00.500Z] ℹ️ Found 45 expired medicine batches
[2026-01-01T12:00:00.500Z] ⚠️ === DRY RUN MODE - No data will be deleted ===
[2026-01-01T12:00:00.500Z] ℹ️ Would delete 45 expired medicine batches

Sample batches to be deleted:
  1. Paracetamol 500mg - Batch: B001, Expired: 2023-06-15
  2. Amoxicillin 250mg - Batch: B002, Expired: 2023-07-20
  ...

Estimated deletions:
  Expiry Alerts: 135
  Current Inventory: 45
  Stock Transactions: 180
  Purchase Items: 45
```

### Sample Output (Production Run)

```
[2026-01-01T12:00:00.000Z] ℹ️ Mode: PRODUCTION (Will Delete Data)
[2026-01-01T12:00:00.000Z] ℹ️ Processing 45 expired batches...
[2026-01-01T12:00:05.000Z] ℹ️ Progress: 10/45 batches processed
[2026-01-01T12:00:10.000Z] ℹ️ Progress: 20/45 batches processed
[2026-01-01T12:00:15.000Z] ℹ️ Progress: 30/45 batches processed
[2026-01-01T12:00:20.000Z] ℹ️ Progress: 40/45 batches processed
[2026-01-01T12:00:23.000Z] ℹ️ Progress: 45/45 batches processed

[2026-01-01T12:00:23.000Z] ✅ ========================================
[2026-01-01T12:00:23.000Z] ✅ Cleanup Completed Successfully
[2026-01-01T12:00:23.000Z] ✅ ========================================
Deletion Summary:
  Expiry Alerts: 135
  Current Inventory: 45
  Stock Transactions: 180
  Purchase Items: 45
  Orphaned Purchases: 12

Total execution time: 23.45 seconds
```

## Safety Features

### 1. Dry Run Mode

Always test with dry run first to preview what will be deleted:

```bash
npm run dry-run
```

### 2. Verbose Logging

Detailed logging of every operation for audit trails. Logs include:
- Timestamp for each operation
- Number of records deleted from each table
- Total execution time
- Error messages with context

### 3. Error Handling

- Graceful error handling with detailed error messages
- Failed operations are logged with context
- Script exits with appropriate exit codes (0 = success, 1 = failure)

### 4. Service Role Key

Uses Supabase service role key to bypass RLS, ensuring complete cleanup across all pharmacies.

### 5. Backup Recommendation

**⚠️ IMPORTANT**: Always backup your database before running in production:

```bash
# Using Supabase CLI
supabase db dump -f backup-$(date +%Y%m%d).sql

# Or use Supabase Dashboard > Database > Backups
```

## Troubleshooting

### Error: Missing environment variables

**Problem**: `❌ Error: Missing required environment variables`

**Solution**: Ensure `.env` file exists and contains valid `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

### Error: Connection timeout

**Problem**: Script hangs or times out

**Solution**: 
- Check your internet connection
- Verify Supabase project is active
- Check if service role key is correct

### Error: Permission denied

**Problem**: `Error: permission denied for table`

**Solution**: Ensure you're using the **Service Role Key**, not the anon key

### No records deleted

**Problem**: Script runs but deletes 0 records

**Solution**: 
- Check if there are any expired medicines older than 2 years
- Run in dry-run mode to see what would be deleted
- Verify the cutoff date calculation is correct

## Testing

### Test with Sample Data

1. Insert test data with old expiry dates:

```sql
-- Insert a test medicine that expired 3 years ago
INSERT INTO purchase_items (
  purchase_id, medicine_id, batch_number, expiry_date,
  quantity, mrp, purchase_rate
) VALUES (
  'existing-purchase-id',
  'existing-medicine-id',
  'TEST-BATCH-001',
  '2023-01-01', -- 3 years ago
  10, 100.00, 80.00
);
```

2. Run in dry-run mode:

```bash
npm run dry-run
```

3. Verify the test batch appears in the preview

4. Run in production mode:

```bash
npm run dev
```

5. Verify the test batch was deleted

## Maintenance

### Update Retention Period

To change the retention period (default 2 years), update the environment variable:

```env
# Keep expired medicines for 3 years instead of 2
CLEANUP_RETENTION_YEARS=3
```

Or pass it when running:

```bash
CLEANUP_RETENTION_YEARS=3 npm run dev
```

### Monitor Performance

For large databases, consider:
- Running during off-peak hours
- Adding batch processing with delays
- Monitoring execution time and adjusting schedule

## Security Considerations

1. **Service Role Key**: Keep it secure, never commit to version control
2. **Access Control**: Limit who can run this script
3. **Audit Trail**: Keep logs of all cleanup operations
4. **Backup**: Always maintain recent backups before cleanup
5. **Testing**: Always test in staging environment first

## Support

For issues or questions:
1. Check the logs for detailed error messages
2. Run in dry-run mode to debug
3. Verify database schema matches expected structure
4. Check Supabase project status and connectivity

## License

Part of the Pharmacy Management System
