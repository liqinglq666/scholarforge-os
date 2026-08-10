'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  MAX_REQUEST_BYTES,
  MAX_SOURCE_CHARACTERS,
  REVIEW_RATE_WINDOW_MINUTES,
  REVIEW_REQUESTS_PER_WINDOW,
} from '@/lib/config';
import type { ReviewServiceStatus } from '@/lib/types';

const SERVICE_STATUS_CACHE_MS = 30_000;
export const SERVICE_STATUS_RETRY_MS = 10_000;

const FALLBACK_SERVICE_STATUS: ReviewServiceStatus = {
  configured: false,
  model: null,
  message: '暂时无法确认服务状态。为了保护正文，分析按钮已禁用；本地编辑和导出仍可使用。',
  limits: {
    maxCharacters: MAX_SOURCE_CHARACTERS,
    maxRequestBytes: MAX_REQUEST_BYTES,
    requestsPerWindow: REVIEW_REQUESTS_PER_WINDOW,
    windowMinutes: REVIEW_RATE_WINDOW_MINUTES,
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

function isPositiveFiniteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function parseReviewServiceStatus(value: unknown): ReviewServiceStatus | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const payload = value as Partial<ReviewServiceStatus>;
  if (typeof payload.configured !== 'boolean' || typeof payload.message !== 'string') return null;
  if (payload.configured) {
    if (typeof payload.model !== 'string' || !payload.model.trim()) return null;
  } else if (payload.model !== null) {
    return null;
  }

  const limits = payload.limits;
  if (!limits || typeof limits !== 'object') return null;
  if (
    !isPositiveFiniteNumber(limits.maxCharacters)
    || !isPositiveFiniteNumber(limits.maxRequestBytes)
    || !isPositiveFiniteNumber(limits.requestsPerWindow)
    || !isPositiveFiniteNumber(limits.windowMinutes)
  ) return null;

  return {
    configured: payload.configured,
    model: payload.configured ? payload.model.trim() : null,
    message: payload.message,
    limits: {
      maxCharacters: limits.maxCharacters,
      maxRequestBytes: limits.maxRequestBytes,
      requestsPerWindow: limits.requestsPerWindow,
      windowMinutes: limits.windowMinutes,
    },
  };
}

async function fetchServiceStatus(force = false): Promise<ServiceStatusSnapshot> {
  if (!force && hasFreshSnapshot() && cachedSnapshot) return cachedSnapshot;
  if (pendingRequest) return pendingRequest;

  pendingRequest = fetch('/api/health', { cache: 'no-store' })
    .then(async (response) => {
      if (!response.ok) throw new Error('health check failed');
      const payload = await response.json() as unknown;
      const status = parseReviewServiceStatus(payload);
      if (!status) throw new Error('invalid health payload');
      return status;
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

  useEffect(() => {
    if (!snapshot?.failed) return;
    const timer = window.setTimeout(() => {
      void reloadStatus();
    }, SERVICE_STATUS_RETRY_MS);
    return () => window.clearTimeout(timer);
  }, [reloadStatus, snapshot?.failed, snapshot?.fetchedAt]);

  return {
    status: snapshot?.status || null,
    loading: snapshot === null,
    failed: snapshot?.failed === true,
    reloadStatus,
  };
}
