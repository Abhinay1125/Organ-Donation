import React from 'react';
import { CheckCircle2, Clock, AlertCircle, MinusCircle, Truck, HelpCircle } from 'lucide-react';

/**
 * Unified status mapping following the healthcare design system:
 * - green: completed / cleared suitability / active
 * - blue: in transit / dispatch / delivered
 * - amber: pending / awaiting review / in progress
 * - red: error / rejected / cancelled / failed
 * - info: clinical decision-support output (neutral informational, no check or alert)
 * - gray: inactive / unassigned
 */
const STATUS_CONFIG_MAP = {
  // Donor stages & decisions
  PENDING_APPROVAL: { category: 'amber', label: 'Pending Approval' },
  APPROVED: { category: 'green', label: 'Approved' },
  DONATED: { category: 'green', label: 'Donated' },
  REJECTED: { category: 'red', label: 'Rejected' },

  // Recipient stages
  WAITING: { category: 'amber', label: 'Waiting' },
  TRANSPLANTED: { category: 'green', label: 'Transplanted' },

  // Organ lifecycle stages
  MEDICALLY_APPROVED: { category: 'green', label: 'Medically Approved' },
  MATCHED: { category: 'amber', label: 'Matched' },
  READY_FOR_RETRIEVAL: { category: 'amber', label: 'Ready For Retrieval' },
  RETRIEVED: { category: 'amber', label: 'Retrieved' },
  PACKAGED: { category: 'amber', label: 'Packaged' },
  DISPATCHED: { category: 'blue', label: 'Dispatched' },
  IN_TRANSIT: { category: 'blue', label: 'In Transit' },
  DELIVERED: { category: 'blue', label: 'Delivered' },
  RECEIVED: { category: 'amber', label: 'Received' },
  CANCELLED: { category: 'red', label: 'Cancelled' },

  // Match review decision
  PENDING: { category: 'amber', label: 'Pending Review' },
  FAILED: { category: 'red', label: 'Review Failed' },

  // ML / Rule decision-support outputs
  COMPATIBLE: { category: 'info', label: 'Rule check: Passed' },
  INCOMPATIBLE: { category: 'info', label: 'Rule check: Failed' },
  HIGH: { category: 'info', label: 'Model score: High' },
  'HIGH COMPATIBILITY': { category: 'info', label: 'Model score: High' },
  MODERATE: { category: 'info', label: 'Model score: Moderate' },
  'MODERATE COMPATIBILITY': { category: 'info', label: 'Model score: Moderate' },
  LOW: { category: 'info', label: 'Model score: Low' },
  'LOW COMPATIBILITY': { category: 'info', label: 'Model score: Low' },

  // Inactive / neutral
  ACTIVE: { category: 'green', label: 'Active' },
  INACTIVE: { category: 'gray', label: 'Inactive' },
};

const CATEGORIES = {
  green: {
    className: 'badge-success',
    icon: CheckCircle2,
    style: {
      backgroundColor: 'var(--color-status-green-bg)',
      color: 'var(--color-status-green-text)',
      borderColor: 'var(--color-status-green-border)',
    },
  },
  blue: {
    className: 'badge-transit',
    icon: Truck,
    style: {
      backgroundColor: 'var(--color-status-blue-bg)',
      color: 'var(--color-status-blue-text)',
      borderColor: 'var(--color-status-blue-border)',
    },
  },
  amber: {
    className: 'badge-warning',
    icon: Clock,
    style: {
      backgroundColor: 'var(--color-status-amber-bg)',
      color: 'var(--color-status-amber-text)',
      borderColor: 'var(--color-status-amber-border)',
    },
  },
  red: {
    className: 'badge-error',
    icon: AlertCircle,
    style: {
      backgroundColor: 'var(--color-status-red-bg)',
      color: 'var(--color-status-red-text)',
      borderColor: 'var(--color-status-red-border)',
    },
  },
  gray: {
    className: 'badge-neutral',
    icon: MinusCircle,
    style: {
      backgroundColor: 'var(--color-status-gray-bg)',
      color: 'var(--color-status-gray-text)',
      borderColor: 'var(--color-status-gray-border)',
    },
  },
  info: {
    className: 'badge-info',
    icon: null,
    style: {
      backgroundColor: 'var(--color-status-info-bg)',
      color: 'var(--color-status-info-text)',
      borderColor: 'var(--color-status-info-border)',
    },
  },
};

export const StatusBadge = ({ status }) => {
  if (!status) return null;
  const raw = String(status).trim();
  const normalized = raw.toUpperCase();
  const entry = STATUS_CONFIG_MAP[normalized];

  const category = entry ? entry.category : 'gray';
  const label = entry
    ? entry.label
    : raw
        .replace(/[_-]+/g, ' ')
        .trim()
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');

  const config = CATEGORIES[category] || CATEGORIES.gray;
  const Icon = config.icon;

  return (
    <span className={`badge ${config.className}`} style={config.style}>
      {Icon && <Icon size={12} aria-hidden="true" style={{ flexShrink: 0 }} />}
      <span>{label}</span>
    </span>
  );
};
