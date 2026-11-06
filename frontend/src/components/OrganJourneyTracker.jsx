import React from 'react';
import { 
  Building, 
  CheckCircle2, 
  CircleDot, 
  Circle, 
  Clock, 
  Truck, 
  User, 
  FileText, 
  Hash, 
  ArrowRight, 
  Shield, 
  Layers, 
  Minus,
  Lock,
  PlayCircle,
  Sparkles
} from 'lucide-react';
import { dutyLabel } from '../authz';
import { StatusBadge } from './StatusBadge';
import {
  JOURNEY_MILESTONES,
  STATUS_INDEX_MAP,
  formatJourneyTime,
  calculateElapsedTime,
  cleanActor
} from '../utils/journey.js';

export {
  JOURNEY_MILESTONES,
  STATUS_INDEX_MAP,
  formatJourneyTime,
  calculateElapsedTime
};

export const OrganJourneyTracker = ({
  organ,
  movements = [],
  sourceHospital,
  destinationHospital,
  donor = null,
  matchedRecipient = null,
  compact = false,
  onNavigateDetail = null,
  authorizedStages = [],
  nextPermissibleStages = [],
  onInitiateTransition = null,
  onInspectStage = null,
  onRestrictedClick = null,
  user = null,
}) => {
  if (!organ) {
    return (
      <div className="journey-tracker-empty" role="status">
        <p>Select an organ to inspect its lifecycle journey.</p>
      </div>
    );
  }

  const currentIdx = STATUS_INDEX_MAP[organ.status] ?? 0;
  const srcName = sourceHospital?.name || (typeof sourceHospital === 'string' ? sourceHospital : (organ.source_hospital_id ? `Hospital #${organ.source_hospital_id}` : 'Donor Center'));
  const dstName = destinationHospital?.name || (typeof destinationHospital === 'string' ? destinationHospital : (organ.destination_hospital_id ? `Hospital #${organ.destination_hospital_id}` : 'Awaiting Assignment'));

  // Pre-calculate movements and status
  let prevTimestamp = null;
  const milestonesWithData = JOURNEY_MILESTONES.map((m, idx) => {
    let movement = null;
    if (m.movementStage) {
      movement = movements.find((mv) => mv.stage === m.movementStage);
    }
    if (m.key === 'donor_facility' && !movement) {
      movement = movements.find((mv) => mv.stage === 'READY_FOR_RETRIEVAL' || mv.stage === 'MEDICALLY_APPROVED');
    }

    let state = 'pending';
    if (organ.status === 'TRANSPLANTED') {
      state = 'completed';
    } else if (m.key === 'donor_facility') {
      if (organ.status === 'READY_FOR_RETRIEVAL' || idx < currentIdx || (movement && movement.stage === 'READY_FOR_RETRIEVAL')) {
        state = 'completed';
      } else {
        state = 'current';
      }
    } else if (idx < currentIdx) {
      state = movement ? 'completed' : 'no-record';
    } else if (idx === currentIdx) {
      state = 'current';
    } else {
      state = 'pending';
    }

    // Check if this milestone corresponds to an authorized or restricted next transition
    const isPermissibleNext = Boolean(
      m.transitionStage && nextPermissibleStages.includes(m.transitionStage) && state !== 'completed'
    );
    const isAuthorized = Boolean(
      isPermissibleNext && authorizedStages.includes(m.transitionStage)
    );
    const isRestricted = Boolean(isPermissibleNext && !isAuthorized);

    let elapsed = null;
    if (movement && movement.timestamp) {
      if (prevTimestamp) {
        elapsed = calculateElapsedTime(movement.timestamp, prevTimestamp);
      }
      prevTimestamp = movement.timestamp;
    }

    // Associated details
    let location = null;
    let actor = null;
    let duty = null;
    let notes = null;
    let tx = null;

    if (m.key === 'donor_facility') {
      location = movement?.location || srcName;
      actor = movement?.actor_name || null;
      duty = movement?.actor_role ? dutyLabel(movement.actor_role) : m.fallbackRole;
      notes = movement?.notes || (donor ? `Donor screening clearance: ${donor.blood_group}, age ${donor.age} yrs` : 'Donor hospital initial verification');
      tx = movement?.blockchain_tx || donor?.blockchain_tx || null;
    } else if (m.key === 'destination_arrival') {
      location = movement?.location || dstName;
      if (movement) {
        actor = movement.actor_name;
        duty = movement.actor_role ? dutyLabel(movement.actor_role) : m.fallbackRole;
        notes = movement.notes;
        tx = movement.blockchain_tx;
      }
    } else if (movement) {
      location = movement.location || (idx <= 3 ? srcName : dstName);
      actor = movement.actor_name;
      duty = movement.actor_role ? dutyLabel(movement.actor_role) : m.fallbackRole;
      notes = movement.notes;
      tx = movement.blockchain_tx;
    } else if (m.key === 'transport' && state === 'completed') {
      notes = 'In-route transit between source and destination hospitals.';
    }

    return {
      ...m,
      movement,
      state,
      isPermissibleNext,
      isAuthorized,
      isRestricted,
      isActionable: isAuthorized,
      elapsed,
      location,
      actor,
      duty,
      notes,
      tx
    };
  });

  return (
    <div className={`journey-tracker-root ${compact ? 'is-compact' : 'is-full'}`}>
      {/* Tracker Header */}
      <div className="journey-tracker-header">
        <div className="journey-header-main">
          <div className="journey-organ-badge">
            <span className="journey-organ-id">{organ.organ_id}</span>
            <span className="journey-organ-type">{organ.organ_type}</span>
          </div>
          <div className="journey-route-summary">
            <span className="journey-facility" title={srcName}>{srcName}</span>
            <ArrowRight size={14} className="journey-route-arrow" aria-hidden="true" />
            <span className="journey-facility" title={dstName}>{dstName}</span>
          </div>
        </div>

        <div className="journey-header-actions">
          <StatusBadge status={organ.status} />
          {compact && onNavigateDetail && (
            <button
              type="button"
              onClick={() => onNavigateDetail(organ.id)}
              className="btn btn-outline btn-sm"
            >
              Full Journey
            </button>
          )}
        </div>
      </div>

      {/* Horizontal Stepper (Desktop/Tablet) */}
      <div className="journey-stepper-wrap" aria-label="Organ lifecycle progress">
        <ol className="journey-stepper-list">
          {milestonesWithData.map((stage, i) => {
            const isCompleted = stage.state === 'completed';
            const isCurrent = stage.state === 'current';
            const isNoRecord = stage.state === 'no-record';
            const isActionable = stage.isActionable;
            const isRestricted = stage.isRestricted;
            const isClickable = !compact && (isCompleted || isCurrent || isActionable || isRestricted);

            const stepClasses = [
              'journey-step-item',
              `step-${stage.state}`,
              isActionable ? 'step-actionable' : '',
              isRestricted ? 'step-restricted' : '',
            ].filter(Boolean).join(' ');

            const handleStepClick = () => {
              if (compact) return;
              if (isActionable && onInitiateTransition) {
                onInitiateTransition(stage.transitionStage, stage);
              } else if (isRestricted && onRestrictedClick) {
                onRestrictedClick(stage);
              } else if ((isCompleted || isCurrent) && onInspectStage) {
                onInspectStage(stage);
              }
            };

            return (
              <li
                key={stage.key}
                className={stepClasses}
                aria-current={isCurrent ? 'step' : undefined}
              >
                <button
                  type="button"
                  onClick={handleStepClick}
                  disabled={!isClickable}
                  className={`journey-step-btn ${isClickable ? 'is-clickable' : ''}`}
                  title={
                    isActionable
                      ? `Authorized: Click to advance to ${stage.label}`
                      : isRestricted
                      ? `Restricted to ${stage.fallbackRole}`
                      : isCompleted
                      ? `Completed: Click to inspect ${stage.label} history`
                      : isCurrent
                      ? `Active: Click to inspect ${stage.label} details`
                      : `${stage.label} (Prerequisites pending)`
                  }
                  aria-label={
                    isActionable
                      ? `Advance to ${stage.label}`
                      : isRestricted
                      ? `${stage.label} (Restricted to ${stage.fallbackRole})`
                      : `${stage.label} (${stage.state})`
                  }
                >
                  <div className="journey-step-marker">
                    {isActionable && <PlayCircle size={15} aria-hidden="true" className="marker-icon actionable" />}
                    {!isActionable && isRestricted && <Lock size={13} aria-hidden="true" className="marker-icon restricted" />}
                    {!isActionable && !isRestricted && isCompleted && <CheckCircle2 size={16} aria-hidden="true" className="marker-icon completed" />}
                    {!isActionable && !isRestricted && isCurrent && <CircleDot size={16} aria-hidden="true" className="marker-icon current" />}
                    {!isActionable && !isRestricted && isNoRecord && <Minus size={14} aria-hidden="true" className="marker-icon norecord" />}
                    {!isActionable && !isRestricted && !isCompleted && !isCurrent && !isNoRecord && (
                      <Circle size={14} aria-hidden="true" className="marker-icon pending" />
                    )}
                  </div>
                  <div className="journey-step-content">
                    <span className="journey-step-label">{stage.label}</span>
                    <span className="journey-step-status-text">
                      {isActionable ? (
                        <span className="journey-action-tag">
                          <Sparkles size={9} aria-hidden="true" /> Action Available
                        </span>
                      ) : isRestricted ? (
                        <span className="journey-restricted-tag">
                          <Lock size={9} aria-hidden="true" /> Restricted
                        </span>
                      ) : isCompleted ? (
                        'Completed'
                      ) : isCurrent ? (
                        'Active Stage'
                      ) : isNoRecord ? (
                        'Logged'
                      ) : (
                        'Pending'
                      )}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Chronological Detailed Log (Full mode or detailed view) */}
      {!compact && (
        <div className="journey-timeline-detail">
          <h3 className="journey-timeline-title">Stage Progression & Audit Trail</h3>
          <ol className="journey-log-list">
            {milestonesWithData.map((item, idx) => {
              const formattedDate = item.movement?.timestamp ? formatJourneyTime(item.movement.timestamp) : null;
              const isPastOrCurrent = item.state === 'completed' || item.state === 'current';

              return (
                <li key={item.key} className={`journey-log-item state-${item.state} ${item.isActionable ? 'state-actionable' : ''}`}>
                  {/* Left Column: Timestamp */}
                  <div className="journey-log-time-col">
                    {formattedDate ? (
                      <>
                        <span className="journey-log-time">{formattedDate}</span>
                        {item.elapsed && (
                          <span className="journey-log-elapsed">+{item.elapsed}</span>
                        )}
                      </>
                    ) : (
                      <span className="journey-log-notime">
                        {item.isActionable ? 'Ready to record' : item.isRestricted ? 'Restricted duty' : isPastOrCurrent ? 'Implicit transition' : 'Pending'}
                      </span>
                    )}
                  </div>

                  {/* Marker Node */}
                  <div className="journey-log-marker-col">
                    <div className={`journey-node node-${item.state} ${item.isActionable ? 'node-actionable' : ''}`}>
                      {item.isActionable && <PlayCircle size={14} aria-hidden="true" />}
                      {!item.isActionable && item.isRestricted && <Lock size={12} aria-hidden="true" />}
                      {!item.isActionable && !item.isRestricted && item.state === 'completed' && <CheckCircle2 size={13} aria-hidden="true" />}
                      {!item.isActionable && !item.isRestricted && item.state === 'current' && <CircleDot size={13} aria-hidden="true" />}
                      {!item.isActionable && !item.isRestricted && item.state === 'pending' && <Circle size={10} aria-hidden="true" />}
                      {!item.isActionable && !item.isRestricted && item.state === 'no-record' && <Minus size={11} aria-hidden="true" />}
                    </div>
                    {idx < milestonesWithData.length - 1 && <div className="journey-connector-line" />}
                  </div>

                  {/* Right Content Card */}
                  <div
                    className={`journey-log-card ${(item.state === 'completed' || item.state === 'current') && onInspectStage ? 'card-clickable' : ''}`}
                    onClick={() => {
                      if ((item.state === 'completed' || item.state === 'current') && onInspectStage) {
                        onInspectStage(item);
                      }
                    }}
                  >
                    <div className="journey-card-top">
                      <span className="journey-card-heading">{item.label}</span>
                      <span className={`journey-state-pill pill-${item.state}`}>
                        {item.isActionable
                          ? 'Action Available'
                          : item.isRestricted
                          ? 'Restricted'
                          : item.state === 'completed'
                          ? 'Completed'
                          : item.state === 'current'
                          ? 'Current Stage'
                          : item.state === 'no-record'
                          ? 'Implicit'
                          : 'Pending'}
                      </span>
                    </div>

                    <div className="journey-card-metadata">
                      {item.location && (
                        <div className="journey-meta-field">
                          <Building size={13} aria-hidden="true" className="meta-icon" />
                          <span className="meta-label">Location:</span>
                          <span className="meta-value">{item.location}</span>
                        </div>
                      )}

                      {item.actor && (
                        <div className="journey-meta-field">
                          <User size={13} aria-hidden="true" className="meta-icon" />
                          <span className="meta-label">Actor:</span>
                          <span className="meta-value">{cleanActor(item.actor)}</span>
                        </div>
                      )}

                      {item.duty && (
                        <div className="journey-meta-field">
                          <Layers size={13} aria-hidden="true" className="meta-icon" />
                          <span className="meta-label">Role:</span>
                          <span className="meta-value">{item.duty}</span>
                        </div>
                      )}

                      {item.tx && (
                        <div className="journey-meta-field">
                          <Hash size={13} aria-hidden="true" className="meta-icon" />
                          <span className="meta-label">Tx Ref:</span>
                          <span className="meta-value code-font" title={item.tx}>
                            {item.tx.slice(0, 10)}...{item.tx.slice(-6)}
                          </span>
                        </div>
                      )}
                    </div>

                    {item.notes && (
                      <p className="journey-card-notes">"{item.notes}"</p>
                    )}

                    {/* Action trigger button inside card for actionable stage */}
                    {item.isActionable && onInitiateTransition && (
                      <div className="journey-log-action-container" onClick={(e) => e.stopPropagation()}>
                        <span className="journey-action-prompt">
                          You are authorized to record this stage transition.
                        </span>
                        <button
                          type="button"
                          onClick={() => onInitiateTransition(item.transitionStage, item)}
                          className="btn btn-primary btn-sm"
                        >
                          <PlayCircle size={14} aria-hidden="true" />
                          <span>Advance to {item.label}</span>
                        </button>
                      </div>
                    )}

                    {/* Restricted notice inside card */}
                    {item.isRestricted && onRestrictedClick && (
                      <div className="journey-log-action-container" onClick={(e) => e.stopPropagation()}>
                        <span className="journey-restricted-notice">
                          <Lock size={13} aria-hidden="true" />
                          <span>Restricted to {item.fallbackRole} role</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => onRestrictedClick(item)}
                          className="btn btn-outline btn-xs"
                        >
                          View Restriction Info
                        </button>
                      </div>
                    )}

                    {(item.state === 'completed' || item.state === 'current') && onInspectStage && (
                      <div style={{ marginTop: '0.5rem', textAlign: 'right' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 500 }}>
                          Inspect details →
                        </span>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="notice-banner" style={{ marginTop: '1rem', borderStyle: 'solid' }}>
            <Shield size={16} flexShrink={0} style={{ color: 'var(--color-primary)', marginTop: '2px' }} aria-hidden="true" />
            <div>
              <strong>Audit & Transaction Reference</strong>
              <span>
                Transaction references are cryptographic hashes stored with each recorded movement. Recorded stages reflect authentic hospital database audit entries.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
