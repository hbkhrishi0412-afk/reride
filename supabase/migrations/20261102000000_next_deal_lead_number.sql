-- Atomic lead-number allocation (avoids duplicate RR-LD- ids under concurrent inserts).
CREATE OR REPLACE FUNCTION public.next_deal_lead_number()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned integer;
BEGIN
  UPDATE deal_lead_sequence
  SET next_val = next_val + 1
  WHERE id = 1
  RETURNING next_val - 1 INTO assigned;

  IF assigned IS NULL THEN
    INSERT INTO deal_lead_sequence (id, next_val) VALUES (1, 102)
    ON CONFLICT (id) DO UPDATE SET next_val = deal_lead_sequence.next_val + 1
    RETURNING next_val - 1 INTO assigned;
  END IF;

  RETURN COALESCE(assigned, 101);
END;
$$;

REVOKE ALL ON FUNCTION public.next_deal_lead_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_deal_lead_number() TO service_role;
