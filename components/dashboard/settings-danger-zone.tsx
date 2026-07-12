"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

export function SettingsDangerZone({ businessName }: { businessName: string }) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [open, setOpen] = useState(false);

  const canDelete = confirmText === businessName;

  async function deleteAccount() {
    setDeleting(true);
    const res = await fetch("/api/account/delete", { method: "POST" });
    setDeleting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast({ variant: "destructive", title: "Couldn't delete account", description: data?.error });
      return;
    }

    setOpen(false);
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-destructive/20 bg-destructive/[0.03] p-6">
      <div className="mb-1 flex items-center gap-2">
        <TriangleAlert className="h-4 w-4 text-destructive" />
        <h2 className="text-[15px] font-bold text-destructive">Danger zone</h2>
      </div>
      <p className="mb-4 text-[13px] text-muted-foreground">
        Permanently delete your account, business profile, and all associated conversations. This can&apos;t be undone.
      </p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="destructive" size="sm" className="w-auto px-4">
            Delete account
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This permanently deletes [{businessName}] and every conversation, message, and setting attached to it.
              There is no way to undo this.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <label className="text-[13px] font-semibold">
              Type <span className="font-mono">{businessName}</span> to confirm
            </label>
            <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" disabled={!canDelete || deleting} onClick={deleteAccount}>
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Permanently delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
