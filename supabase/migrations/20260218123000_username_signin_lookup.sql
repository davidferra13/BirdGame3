-- Allow username-based sign-in by resolving username -> email via SECURITY DEFINER RPC.
-- This keeps client auth flow as password-based Supabase Auth while supporting username input.

CREATE OR REPLACE FUNCTION public.get_login_email_for_username(p_username text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  IF p_username IS NULL OR length(trim(p_username)) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT u.email
  INTO v_email
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE lower(p.username) = lower(trim(p_username))
  LIMIT 1;

  RETURN v_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_login_email_for_username(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_login_email_for_username(text) TO authenticated;
