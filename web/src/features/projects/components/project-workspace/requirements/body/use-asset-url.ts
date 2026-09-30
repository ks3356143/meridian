import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { requestBlob } from "@/api/client";

export function useAssetUrl(projectCode: string, assetId: string, width = 320) {
  const query = useQuery({
    queryKey: ["requirement-asset", projectCode, assetId, width],
    queryFn: ({ signal }) =>
      requestBlob(
        `/api/v1/projects/${encodeURIComponent(projectCode)}/assets/${encodeURIComponent(assetId)}?w=${width}`,
        signal,
      ),
    enabled: Boolean(assetId),
    staleTime: Infinity,
    gcTime: 10 * 60 * 1000,
    retry: false,
  });

  const [objectUrl, setObjectUrl] = useState<string>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!query.data) {
      // oxlint-disable-next-line react/set-state-in-effect -- object URL 必须在副作用中创建并随查询结果生命周期回收。
      setObjectUrl(undefined);
      return;
    }
    const url = URL.createObjectURL(query.data);
    setObjectUrl(url);
    setFailed(false);
    return () => URL.revokeObjectURL(url);
  }, [query.data]);

  return {
    objectUrl,
    failed,
    markFailed: () => setFailed(true),
    isPending: query.isPending,
    isError: query.isError,
  };
}
