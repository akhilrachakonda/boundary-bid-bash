import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { rpc } from "./rpc";

export function GuestSeat({ roomId, enabled }: { roomId: string; enabled: boolean }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const generate = async () => {
    setCode("");
    setBusy(true);
    try {
      const token = await rpc<string>("issue_seat_code", { p_room: roomId }, { timeoutMs: 10000 });
      if (token) setCode(token);
    } finally {
      setBusy(false);
    }
  };
  return (
    <details className="rounded-md border px-3 py-2 text-sm">
      <summary className="cursor-pointer font-medium">Save your guest seat</summary>
      <p className="my-2">
        Keep your team when you change browsers or devices.{" "}
        <Link
          to="/auth"
          search={{ mode: "link", redirect: `/room/${roomId}` }}
          className="underline"
        >
          Save your account with email
        </Link>
        .
      </p>
      {enabled && (
        <>
          <p>
            Or save a private recovery code with your room code. Anyone with both can take this
            seat. Generating a new code replaces the old one.
          </p>
          <Button variant="outline" size="sm" disabled={busy} onClick={generate}>
            {busy ? "Generating…" : "Generate recovery code"}
          </Button>
          {code && (
            <div className="flex gap-2">
              <Input
                aria-label="Your private seat recovery code"
                value={code}
                readOnly
                onFocus={(e) => e.target.select()}
              />
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(code);
                    toast.success("Recovery code copied");
                  } catch {
                    toast.info("Select the code and copy it.");
                  }
                }}
              >
                Copy
              </Button>
            </div>
          )}
        </>
      )}
    </details>
  );
}

export function ReclaimSeat({
  roomCode,
  onRecovered,
}: {
  roomCode: string;
  onRecovered: (id: string) => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const reclaim = async () => {
    setBusy(true);
    try {
      const id = await rpc<string | null>(
        "reclaim_guest_seat",
        { p_code: roomCode, p_token: code.trim() },
        { timeoutMs: 12000, preserveNull: true },
      );
      if (typeof id === "string") onRecovered(id);
      else if (id !== undefined)
        toast.error("Check both codes. A recovery code can only be used once.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer">Recover my guest team</summary>
      <p className="my-2">Enter the private recovery code you saved for this room.</p>
      <Input
        aria-label="Private recovery code"
        value={code}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => setCode(e.target.value)}
      />
      <Button
        variant="outline"
        disabled={
          busy || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(code.trim())
        }
        onClick={reclaim}
      >
        {busy ? "Recovering…" : "Recover seat"}
      </Button>
    </details>
  );
}
