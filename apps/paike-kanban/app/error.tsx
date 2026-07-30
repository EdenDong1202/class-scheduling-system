"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[page error]", error);
  }, [error]);

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3">
      <AlertCircle className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">数据加载失败，请稍后重试</p>
      <Button variant="outline" size="sm" onClick={reset}>
        重新加载
      </Button>
    </div>
  );
}
