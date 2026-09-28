"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { archiveFlag } from "@/modules/flags/actions";

export function ArchiveFlagButton({
  flagId,
  flagKey,
}: {
  flagId: string;
  flagKey: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await archiveFlag(flagId);
          if (result.ok) toast.success(`${flagKey} archived.`);
          else toast.error(result.error);
        })
      }
    >
      Archive flag
    </Button>
  );
}
