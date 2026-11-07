# Pool-group access correction — 2026-11-07

Scope: only the selected pool-group access finding. No publication, roster edits,
room mutations, or changes to other findings.

Applied tracked migration `0025_harden_pool_group_snapshot_access.sql` through
the managed migration tool. The migration:

- Revokes all pool-group table privileges from PUBLIC, anon and authenticated.
- Grants only SELECT to authenticated and full table access to service_role.
- Preserves RLS and the existing SELECT policy name, replacing its unconditional
  predicate with `public.can_read_snapshot(snapshot_id)`.
- Uses the existing authenticated, fixed-search-path snapshot helper: validated
  snapshots, snapshots frozen into the caller's rooms, or admin access.
- Includes fail-closed assertions on effective caller privileges, PUBLIC grants,
  grant options, service access and the sole SELECT policy.

## Verification performed this turn

- Effective privileges: anon has none; authenticated has SELECT only, with no
  INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES or TRIGGER privileges;
  service_role retains all seven checked privileges.
- PUBLIC ACL entries: zero. RLS remains enabled; sole policy is authenticated
  SELECT using `can_read_snapshot(snapshot_id)`.
- Before/after whole-row fingerprints match for all 600 player rows, 1,200
  pool-group rows and 49 rooms. No application data was changed by this fix.
- Focused Vitest run: two files, 12 tests passed (`pool-ratio` and
  `evaluation-v3`). No manual build or typecheck was run.
- Quick security recheck no longer reports the selected pool-group finding.
  Two unrelated informational findings appeared; neither was changed or ignored.

This verifies the targeted permissions correction, not a full security audit or
completion of the broader roster, capacity, evaluation and portrait work.