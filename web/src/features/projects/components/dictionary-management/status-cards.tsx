import { QueryError, QueryLoading } from "@/components/shared/query-state";

export function LoadingCard({ label, rows = 5 }: { label: string; rows?: number }) {
  return <QueryLoading label={label} rows={rows} />;
}

export function ErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <QueryError
      title="字典加载失败"
      description="请确认后端服务已启动，然后重新加载。"
      onRetry={onRetry}
    />
  );
}
