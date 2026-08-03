'use client';

import { useEffect, useState } from 'react';
import type { ReviewServiceStatus } from '@/lib/types';

export function TryServiceStatus() {
  const [status, setStatus] = useState<ReviewServiceStatus | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/health', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('health check failed');
        return response.json() as Promise<ReviewServiceStatus>;
      })
      .then((value) => { if (active) setStatus(value); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);

  if (failed) {
    return <span className="try-service-state unavailable" role="status"><i aria-hidden="true" />暂时无法确认模型状态</span>;
  }
  if (!status) {
    return <span className="try-service-state checking" role="status"><i aria-hidden="true" />正在确认模型状态</span>;
  }
  return (
    <span className={status.configured ? 'try-service-state available' : 'try-service-state unavailable'} role="status">
      <i aria-hidden="true" />{status.configured ? `模型服务可用 · ${status.model || '已配置模型'}` : '模型服务暂未配置'}
    </span>
  );
}
