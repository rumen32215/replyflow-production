"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { Acknowledgement, ACK, useAcknowledgement } from "@/components/shared/acknowledgement";
import { createClient } from "@/lib/supabase/client";

/**
 * Master Execution Plan 2.3 — one of the three real fields
 * `06-Experience-Architecture.md` §4 named as missing. Deliberately a
 * plain text note, not a structured dropdown of contact channels/
 * hours — a short line in the owner's own words ("prefers a text over
 * a call") reads like a receptionist's memory; a form field reads
 * like a CRM. Same quiet-autosave pattern already established on the
 * Diary and Receptionist pages (700ms debounce, no Save button).
 * Owner-entered only — never inferred from message content, matching
 * this page's own existing fact-grounding discipline.
 */
export function CommunicationPreference({
  conversationId,
  initial,
}: {
  conversationId: string;
  initial: string | null;
}) {
  const supabase = createClient();
  const { message, isError, isSaving, startSaving, acknowledge, softError } = useAcknowledgement();
  const [value, setValue] = useState(initial ?? "");
  const [editing, setEditing] = useState(false);

  const firstRender = useRef(true);
  const requestId = useRef(0);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(async () => {
      const thisRequest = ++requestId.current;
      startSaving();
      try {
        const { error } = await supabase
          .from("conversations")
          .update({ communication_preference: value.trim() || null })
          .eq("id", conversationId);
        if (thisRequest !== requestId.current) return;
        if (error) softError();
        else acknowledge(ACK.remember);
      } catch {
        if (thisRequest === requestId.current) softError();
      }
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!editing && !value) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="mt-2 flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground hover:text-primary"
      >
        <Pencil className="h-3 w-3" /> Add a communication preference
      </button>
    );
  }

  return (
    <div className="mt-2">
      {editing ? (
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => setEditing(false)}
          placeholder="e.g. Prefers a text over a call"
          className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-[12.5px] outline-none focus:border-primary"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex items-center gap-1.5 text-left text-[12.5px] text-foreground hover:text-primary"
        >
          <Pencil className="h-3 w-3 shrink-0 text-muted-foreground" />
          {value}
        </button>
      )}
      <Acknowledgement message={message} isError={isError} isSaving={isSaving} className="mt-1" />
    </div>
  );
}
