'use client';

import { useReviewServiceStatus } from '@/components/review/use-review-service-status';

export function TryServiceStatus() {
  const { status, loading, failed } = useReviewServiceStatus();

  if (failed) {
    return <span className="try-service-state unavailable" role="status"><i aria-hidden="true" />暂时无法确认模型状态</span>;
  }
  if (loading || !status) {
    return <span className="try-service-state checking" role="status"><i aria-hidden="true" />正在确认模型状态</span>;
  }
  return (
    <span className={status.configured ? 'try-service-state available' : 'try-service-state unavailable'} role="status">
      <i aria-hidden="true" />{status.configured ? `模型服务可用 · ${status.model || '已配置模型'}` : '模型服务暂未配置'}
    </span>
  );
}
