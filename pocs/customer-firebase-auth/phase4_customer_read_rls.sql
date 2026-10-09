-- Additive Firebase customer-only read access. Legacy Supabase policies untouched.
-- Missing/unapproved Firebase mapping resolves NULL and grants no records.
CREATE OR REPLACE FUNCTION public.customer_firebase_can_read_customer(p_customer_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $body$
 SELECT p_customer_id IS NOT NULL
 AND public.customer_firebase_profile_id() IS NOT NULL
 AND EXISTS (
   SELECT 1 FROM public.customers c
   WHERE c.id=p_customer_id
     AND (
       c.profile_id=public.customer_firebase_profile_id()
       OR EXISTS (SELECT 1 FROM public.customer_memberships m
          WHERE m.customer_id=c.id
          AND m.profile_id=public.customer_firebase_profile_id()
          AND m.status='active')
     )
 )
$body$;
REVOKE ALL ON FUNCTION public.customer_firebase_can_read_customer(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.customer_firebase_can_read_customer(uuid) TO authenticated;
CREATE POLICY "firebase_customer_profile_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = (select public.customer_firebase_profile_id()));
CREATE POLICY "firebase_customer_memberships_select" ON public.customer_memberships
  FOR SELECT TO authenticated
  USING (profile_id = (select public.customer_firebase_profile_id()) AND status='active');
CREATE POLICY "firebase_customer_accounts_select" ON public.customers
  FOR SELECT TO authenticated
  USING (public.customer_firebase_can_read_customer(id));
CREATE POLICY "firebase_customer_vehicles_select" ON public.vehicles
  FOR SELECT TO authenticated
  USING (public.customer_firebase_can_read_customer(customer_id));
CREATE POLICY "firebase_customer_policies_select" ON public.policies
  FOR SELECT TO authenticated
  USING (public.customer_firebase_can_read_customer(customer_id));
CREATE POLICY "firebase_customer_claims_select" ON public.claims
  FOR SELECT TO authenticated
  USING (public.customer_firebase_can_read_customer(customer_id));
