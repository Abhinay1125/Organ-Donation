import React from 'react';

export const RequestMessage = ({ type = 'error', message, onRetry }) => {
  if (!message) return null;
  const isError = type === 'error';
  return (
    <div className={`notice notice-${type}`} role={isError ? 'alert' : 'status'} aria-live={isError ? 'assertive' : 'polite'}>
      <span>{message}</span>
      {onRetry && (
        <button type="button" className="btn btn-outline btn-sm" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
};
