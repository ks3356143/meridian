import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LoadingCard({ label }: { label: string }) {
  return (
    <Card className="dictionary-reveal">
      <CardContent className="text-muted-foreground flex min-h-48 items-center justify-center gap-2 text-sm">
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        {label}
      </CardContent>
    </Card>
  );
}

export function ErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="dictionary-reveal">
      <CardHeader>
        <CardTitle>字典加载失败</CardTitle>
        <CardDescription>请确认后端服务已启动，然后重新加载。</CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={onRetry}>重新加载</Button>
      </CardContent>
    </Card>
  );
}
