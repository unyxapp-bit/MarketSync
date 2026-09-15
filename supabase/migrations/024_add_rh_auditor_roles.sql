-- Adds the two roles from the spec's permission matrix (section 3) that member_role was
-- missing: RH/DP (colaboradores, regras, relatórios e aprovação) and Auditor (read-only).
-- ALTER TYPE ... ADD VALUE cannot be used in the same transaction as anything that references
-- the new value, so this migration only adds the enum values; 025 wires up what they can do.

alter type public.member_role add value if not exists 'rh';
alter type public.member_role add value if not exists 'auditor';
