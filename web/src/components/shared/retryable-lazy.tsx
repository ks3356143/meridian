import { Component, type ReactNode } from "react";
import { QueryError } from "@/components/shared/query-state";

type LazyChunkBoundaryProps = {
  children: ReactNode;
  errorTitle: string;
};

type LazyChunkBoundaryState = {
  failed: boolean;
};

export class LazyChunkBoundary extends Component<LazyChunkBoundaryProps, LazyChunkBoundaryState> {
  state: LazyChunkBoundaryState = { failed: false };

  static getDerivedStateFromError(): LazyChunkBoundaryState {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <QueryError
          title={this.props.errorTitle}
          description="本地资源加载失败，请检查服务后重试。"
          onRetry={() => window.location.reload()}
        />
      );
    }
    return this.props.children;
  }
}
