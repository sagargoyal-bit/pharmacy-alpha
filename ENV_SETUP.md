# Environment Variables Setup

## Required Environment Variables

### For Local Development (.env.local)

Add these to your `.env.local` file in the root of the `pharmacyPlus` directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Cleanup Configuration
CLEANUP_RETENTION_YEARS=2
NEXT_PUBLIC_CLEANUP_RETENTION_YEARS=2
```

### For Cron Script (cron/.env)

Add these to `cron/.env` file:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Cron Configuration
DRY_RUN=false
CLEANUP_RETENTION_YEARS=2

# Logging
VERBOSE=true
```

### For Vercel Deployment

Go to Vercel Dashboard → Your Project → Settings → Environment Variables

Add these for **Production**, **Preview**, and **Development**:

| Variable Name | Value | Notes |
|--------------|-------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project-id.supabase.co` | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your anon key | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | Your service role key | **Secret** - Use real service role key! |
| `CLEANUP_RETENTION_YEARS` | `2` | Server-side |
| `NEXT_PUBLIC_CLEANUP_RETENTION_YEARS` | `2` | Client-side (for UI display) |

## Why Two Retention Variables?

- **`CLEANUP_RETENTION_YEARS`**: Used by the server-side cleanup logic (API routes, cron)
- **`NEXT_PUBLIC_CLEANUP_RETENTION_YEARS`**: Used by the client-side UI to display retention info

Both should have the **same value** to keep the UI and backend in sync.

## Important Notes

### Service Role Key vs Anon Key

⚠️ **Critical**: The `SUPABASE_SERVICE_ROLE_KEY` must be the **actual service role key**, not the anon key!

To get the correct keys:
1. Go to Supabase Dashboard
2. Select your project
3. Go to **Settings** → **API**
4. Copy:
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

### NEXT_PUBLIC_ Prefix

Variables with `NEXT_PUBLIC_` prefix are:
- Exposed to the browser
- Available in client-side React components
- Safe for non-sensitive configuration

Variables without the prefix are:
- Only available on the server
- Not exposed to the browser
- Used for sensitive operations (like service role key)

## Verification

### Check Local Environment

```bash
# In pharmacyPlus directory
node -e "console.log('Retention Years:', process.env.NEXT_PUBLIC_CLEANUP_RETENTION_YEARS || 'NOT SET')"
```

### Check in Browser Console

```javascript
// Open browser console on your app
console.log('Retention Years:', process.env.NEXT_PUBLIC_CLEANUP_RETENTION_YEARS)
```

### Check Settings Page

1. Go to Admin Settings page
2. Look at the "Data Retention" section in Pharmacy Information
3. It should show "Retention Period: 2 years" (or your configured value)

## Troubleshooting

### "Retention Period: NaN years"

**Problem**: `NEXT_PUBLIC_CLEANUP_RETENTION_YEARS` is not set or invalid

**Solution**: 
1. Add `NEXT_PUBLIC_CLEANUP_RETENTION_YEARS=2` to `.env.local`
2. Restart your Next.js dev server
3. Refresh the browser

### "Last Cleanup: Never run" even after running

**Problem**: Backend not returning `last_cleanup_date` field

**Solution**: 
1. Run the database migration: `database/add_last_cleanup_date.sql`
2. Verify the column exists in Supabase
3. Restart your Next.js dev server

### Cleanup uses wrong retention period

**Problem**: `CLEANUP_RETENTION_YEARS` (server-side) is different from UI display

**Solution**: 
1. Ensure both variables have the same value
2. Restart your Next.js dev server
3. For Vercel, update both environment variables

## Example .env.local

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://yucxhnphgsgqmqteymym.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...(different from anon key!)

# Cleanup
CLEANUP_RETENTION_YEARS=2
NEXT_PUBLIC_CLEANUP_RETENTION_YEARS=2
```

## Security Best Practices

1. ✅ Never commit `.env` or `.env.local` files to git
2. ✅ Keep service role key secret (don't expose to browser)
3. ✅ Use different keys for development and production
4. ✅ Rotate keys periodically
5. ✅ Only expose necessary variables with `NEXT_PUBLIC_` prefix
