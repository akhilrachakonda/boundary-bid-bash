import type { Participant } from "@/hooks/use-room";

// Postgres Changes supplies the full new row even with default replica identity.
// A missing field or a changed team/purse still goes through the normal table read.
export function onlyPresenceChanged(
  previous: Participant | undefined,
  row: Record<string, unknown>,
) {
  return (
    !!previous &&
    typeof row["last_seen"] === "string" &&
    Object.entries(previous).every(([key, value]) => key === "last_seen" || row[key] === value) &&
    Object.keys(row).every((key) => key in previous)
  );
}
