"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { BottomSheet } from "../motion/bottom-sheet";
import { Button } from "../motion/button";

type DeleteRequest = {
  id: string;
  name: string;
  count?: number;
};

declare global {
  interface Window {
    eplusEmojiPacks?: {
      delete?: (id: string) => boolean;
    };
  }
}

export default function PackDeleteConfirm() {
  const [request, setRequest] = useState<DeleteRequest | null>(null);

  useEffect(() => {
    const onRequest = (event: Event) => {
      const detail = (event as CustomEvent<DeleteRequest>).detail;
      if (!detail?.id) return;
      setRequest({
        id: detail.id,
        name: detail.name || "this pack",
        count: Number(detail.count) || 0,
      });
    };

    document.addEventListener("eplus:pack-delete-request", onRequest);
    return () => document.removeEventListener("eplus:pack-delete-request", onRequest);
  }, []);

  const close = () => setRequest(null);

  const confirmDelete = () => {
    if (!request) return;
    const deleted = window.eplusEmojiPacks?.delete?.(request.id);
    if (!deleted) return;

    const url = new URL(window.location.href);
    if (url.searchParams.get("pack") === request.id) {
      url.searchParams.delete("pack");
      window.history.replaceState({}, "", `${url.pathname}${url.search}`);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }

    close();
  };

  return (
    <BottomSheet
      open={Boolean(request)}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      snapPoints={["auto"]}
      title="Delete emoji pack?"
      description={request
        ? `“${request.name}”${request.count ? ` contains ${request.count} emoji` : ""}. This only removes the local pack; the original emoji files are not deleted.`
        : undefined}
      className="!max-w-lg"
    >
      <div className="grid gap-3 pt-3">
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive">
            <Trash2 className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <strong className="block text-sm text-foreground">This action cannot be undone</strong>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              You can rebuild the pack later by selecting emoji again.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="md" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            ripple
            onClick={confirmDelete}
            className="!bg-destructive !text-white hover:!bg-destructive/90"
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Delete pack
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
