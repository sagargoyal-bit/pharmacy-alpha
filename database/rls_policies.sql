-- ===============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- For Pharmacy Management System
-- ===============================================

-- This file sets up secure, multi-tenant RLS policies
-- Each pharmacy can only access their own data

-- ===============================================
-- 1. ENABLE RLS ON ALL TABLES
-- ===============================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_pharmacies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicine_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.current_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expiry_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacy_settings ENABLE ROW LEVEL SECURITY;

-- ===============================================
-- 2. HELPER FUNCTION - GET USER'S PHARMACY ID
-- ===============================================

CREATE OR REPLACE FUNCTION get_user_pharmacy_id()
RETURNS UUID AS $$
BEGIN
  -- Get the pharmacy_id for the current authenticated user
  RETURN (
    SELECT up.pharmacy_id 
    FROM user_pharmacies up 
    WHERE up.user_id = auth.uid() 
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===============================================
-- 3. USERS TABLE POLICIES
-- ===============================================

-- Users can see other users in their pharmacy
CREATE POLICY "Users can view users in their pharmacy" ON public.users
FOR SELECT USING (
  id IN (
    SELECT up2.user_id 
    FROM user_pharmacies up1
    JOIN user_pharmacies up2 ON up1.pharmacy_id = up2.pharmacy_id
    WHERE up1.user_id = auth.uid()
  )
);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.users
FOR UPDATE USING (id = auth.uid());

-- ===============================================
-- 4. PHARMACIES TABLE POLICIES
-- ===============================================

-- Users can only see their own pharmacy
CREATE POLICY "Users can view their pharmacy" ON public.pharmacies
FOR SELECT USING (
  id IN (
    SELECT pharmacy_id 
    FROM user_pharmacies 
    WHERE user_id = auth.uid()
  )
);

-- Only pharmacy owners can update pharmacy details
CREATE POLICY "Owners can update pharmacy" ON public.pharmacies
FOR UPDATE USING (
  owner_id = auth.uid() OR
  id IN (
    SELECT pharmacy_id 
    FROM user_pharmacies 
    WHERE user_id = auth.uid() AND role = 'owner'
  )
);

-- ===============================================
-- 5. USER_PHARMACIES TABLE POLICIES
-- ===============================================

-- Users can see relationships for their pharmacy
CREATE POLICY "View pharmacy relationships" ON public.user_pharmacies
FOR SELECT USING (
  pharmacy_id IN (
    SELECT pharmacy_id 
    FROM user_pharmacies 
    WHERE user_id = auth.uid()
  )
);

-- ===============================================
-- 6. SUPPLIERS TABLE POLICIES
-- ===============================================

-- Users can view suppliers for their pharmacy
CREATE POLICY "View pharmacy suppliers" ON public.suppliers
FOR ALL USING (pharmacy_id = get_user_pharmacy_id());

-- ===============================================
-- 7. MEDICINES TABLE POLICIES
-- ===============================================

-- All users can view medicines (global catalog)
CREATE POLICY "Anyone can view medicines" ON public.medicines
FOR SELECT USING (true);

-- Only authenticated users can add medicines
CREATE POLICY "Authenticated users can add medicines" ON public.medicines
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Only authenticated users can update medicines
CREATE POLICY "Authenticated users can update medicines" ON public.medicines
FOR UPDATE USING (auth.uid() IS NOT NULL);

-- ===============================================
-- 8. MEDICINE CATEGORIES POLICIES
-- ===============================================

-- All users can view medicine categories
CREATE POLICY "Anyone can view categories" ON public.medicine_categories
FOR SELECT USING (true);

-- ===============================================
-- 9. PURCHASES TABLE POLICIES
-- ===============================================

-- Users can only see purchases for their pharmacy
CREATE POLICY "View pharmacy purchases" ON public.purchases
FOR ALL USING (pharmacy_id = get_user_pharmacy_id());

-- ===============================================
-- 10. PURCHASE ITEMS TABLE POLICIES
-- ===============================================

-- Users can view purchase items for their pharmacy's purchases
CREATE POLICY "View pharmacy purchase items" ON public.purchase_items
FOR ALL USING (
  purchase_id IN (
    SELECT id FROM purchases WHERE pharmacy_id = get_user_pharmacy_id()
  )
);

-- ===============================================
-- 11. CURRENT INVENTORY POLICIES
-- ===============================================

-- Users can view inventory for their pharmacy
CREATE POLICY "View pharmacy inventory" ON public.current_inventory
FOR ALL USING (pharmacy_id = get_user_pharmacy_id());

-- ===============================================
-- 12. STOCK TRANSACTIONS POLICIES
-- ===============================================

-- Users can view stock transactions for their pharmacy
CREATE POLICY "View pharmacy stock transactions" ON public.stock_transactions
FOR ALL USING (pharmacy_id = get_user_pharmacy_id());

-- ===============================================
-- 13. EXPIRY ALERTS POLICIES
-- ===============================================

-- Users can view expiry alerts for their pharmacy
CREATE POLICY "View pharmacy expiry alerts" ON public.expiry_alerts
FOR ALL USING (pharmacy_id = get_user_pharmacy_id());

-- ===============================================
-- 14. PHARMACY SETTINGS POLICIES
-- ===============================================

-- Users can view/update settings for their pharmacy
CREATE POLICY "Manage pharmacy settings" ON public.pharmacy_settings
FOR ALL USING (pharmacy_id = get_user_pharmacy_id());

-- ===============================================
-- 15. ANONYMOUS ACCESS POLICIES (FOR DEVELOPMENT)
-- ===============================================

-- TEMPORARY: Allow anonymous access for testing
-- REMOVE THESE IN PRODUCTION!

CREATE POLICY "Allow anon access to users" ON public.users
FOR ALL USING (true);

CREATE POLICY "Allow anon access to pharmacies" ON public.pharmacies
FOR ALL USING (true);

CREATE POLICY "Allow anon access to suppliers" ON public.suppliers
FOR ALL USING (true);

CREATE POLICY "Allow anon access to purchases" ON public.purchases
FOR ALL USING (true);

CREATE POLICY "Allow anon access to purchase_items" ON public.purchase_items
FOR ALL USING (true);

CREATE POLICY "Allow anon access to inventory" ON public.current_inventory
FOR ALL USING (true);

CREATE POLICY "Allow anon access to stock_transactions" ON public.stock_transactions
FOR ALL USING (true);

CREATE POLICY "Allow anon access to expiry_alerts" ON public.expiry_alerts
FOR ALL USING (true);

CREATE POLICY "Allow anon access to settings" ON public.pharmacy_settings
FOR ALL USING (true);

-- ===============================================
-- 16. HOW TO REMOVE ANONYMOUS ACCESS (PRODUCTION)
-- ===============================================

/*
-- When you're ready for production, run this to remove anonymous access:

DROP POLICY "Allow anon access to users" ON public.users;
DROP POLICY "Allow anon access to pharmacies" ON public.pharmacies;
DROP POLICY "Allow anon access to suppliers" ON public.suppliers;
DROP POLICY "Allow anon access to purchases" ON public.purchases;
DROP POLICY "Allow anon access to purchase_items" ON public.purchase_items;
DROP POLICY "Allow anon access to inventory" ON public.current_inventory;
DROP POLICY "Allow anon access to stock_transactions" ON public.stock_transactions;
DROP POLICY "Allow anon access to expiry_alerts" ON public.expiry_alerts;
DROP POLICY "Allow anon access to settings" ON public.pharmacy_settings;

-- Then implement proper authentication in your app
*/

-- ===============================================
-- NOTES:
-- ===============================================

/*
1. DEVELOPMENT MODE:
   - Anonymous policies allow testing without authentication
   - Your current app will work perfectly

2. PRODUCTION MODE:
   - Remove anonymous policies
   - Implement user authentication
   - Each user sees only their pharmacy's data

3. SECURITY BENEFITS:
   - Multi-tenant isolation
   - Data privacy protection
   - Regulatory compliance
   - Prevents data leaks

4. AUTHENTICATION SETUP:
   - Users must sign in through Supabase Auth
   - auth.uid() returns the logged-in user's ID
   - Policies use this to filter data

5. TESTING:
   - Current setup allows full access for development
   - Gradually transition to authenticated access
*/ 