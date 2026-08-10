'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReviewServiceStatus } from '@/lib/types';

const SERVICE_STATUS_CACHE_MS = 30_000;

const FALLBACK_SERVICE_STATUS: ReviewServiceStatus = {
  configured: false,
  model: null,
  message: '暂时无法确认服务状态。为了保护正文，分析按钮已禁用；本地编辑和导出仍可使用。',
  limits: {
    maxCharacters: 12_000,
    maxRequestBytes: 80_000,
    requestsPerWindow: 6,
    windowMinutes: 10,
  },
};

type ServiceStatusSnapshot = {
  status: ReviewServiceStatus;
  failed: boolean;
  fetchedAt: number;
};

let cachedSnapshot: ServiceStatusSnapshot | null = null;
let pendingRequest: Promise<ServiceStatusSnapshot> | null = null;

function hasFreshSnapshot() {
  return cachedSnapshot && Date.now() - cachedSnapshot.fetchedAt < SERVICE_STATUS_CACHE_MS;
}

async function fetchServiceStatus(force = false): Promise<ServiceStatusSnapshot> {
  if (!force && hasFreshSnapshot() && cachedSnapshot) return cachedSnapshot;
  if (!force && pendingRequest) return pendingRequest;

  pendingRequest = fetch('/api/health', { cache: 'no-store' })
    .then(async (response) => {
      if (!response.ok) throw new Error('health check failed');
      return response.json() as Promise<ReviewServiceStatus>;
    })
    .then((status) => ({ status, failed: false, fetchedAt: Date.now() }))
    .catch(() => ({ status: FALLBACK_SERVICE_STATUS, failed: true, fetchedAt: Date.now() }))
    .then((snapshot) => {
      cachedSnapshot = snapshot;
      return snapshot;
    })
    .finally(() => {
      pendingRequest = null;
    });

  return pendingRequest;
}

export function useReviewServiceStatus() {
  const initialSnapshot = hasFreshSnapshot() ? cachedSnapshot : null;
  const [snapshot, setSnapshot] = useState<ServiceStatusSnapshot | null>(initialSnapshot);

  const reloadStatus = useCallback(async () => {
    const next = await fetchServiceStatus(true);
    setSnapshot(next);
    return next.status;
  }, []);

  useEffect(() => {
    let active = true;
    void fetchServiceStatus().then((next) => {
      if (active) setSnapshot(next);
    });
    return () => {
      active = false;
    };
  }, []);

  return {
    status: snapshot?.status || null,
    loading: snapshot === null,
    failed: snapshot?.failed === true,
    reloadStatus,
  };
}
