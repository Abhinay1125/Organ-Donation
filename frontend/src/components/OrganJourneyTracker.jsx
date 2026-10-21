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
  Minus
} from 'lucide-react';
import { dutyLabel } from '../authz';
import { StatusBadge } from './StatusBadge';

export const JOURNEY_MILESTONES = [
  { key: 'donor_facility', label: 'Donor Hospital', movementStage: null, fallbackRole: 'Procurement / Medical Clearance' },
  { key: 'retrieved', label: 'Organ Retrieved', movementStage: 'RETRIEVED', fallbackRole: 'Donor Surgeon' },
  { key: 'packaged', label: 'Packaging', movementStage: 'PACKAGED', fallbackRole: 'Donor Surgeon' },
  { key: 'dispatched', label: 'Dispatched', movementStage: 'DISPATCHED', fallbackRole: 'Transporter' },
  { key: 'transport', label: 'Transportation (application-recorded checkpoint)', movementStage: 'IN_TRANSIT', fallbackRole: 'Transporter' },
  { key: 'destination_arrival', label: 'Destination Hospital', movementStage: 'DELIVERED', fallbackRole: 'Transporter' },
  { key: 'received', label: 'Received', movementStage: 'RECEIVED', fallbackRole: 'Transplant Surgeon' },
  { key: 'transplanted', label: 'Transplantation', movementStage: 'TRANSPLANTED', fallbackRole: 'Transplant Surgeon' }
];

export const STATUS_INDEX_MAP = {
  MEDICALLY_APPROVED: 0,
  MATCHED: 0,
  READY_FOR_RETRIEVAL: 0,
  RETRIEVED: 1,
  PACKAGED: 2,
  DISPATCHED: 3,
  IN_TRANSIT: 4,
  DELIVERED: 5,
  RECEIVED: 6,
  TRANSPLANTED: 7
};

export const formatJourneyTime = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const day = d.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const seconds = d.getSeconds().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12 || 12;
  return `${day} ${month} ${year}, ${hours}:${minutes}:${seconds} ${ampm}`;
};

export const calculateElapsedTime = (currDate, prevDate) => {
  if (!currDate || !prevDate) return null;
  const curr = new Date(currDate).getTime();
  const prev = new Date(prevDate).getTime();
  if (isNaN(curr) || isNaN(prev) || curr < prev) return null;

  const totalSec = Math.floor((curr - prev) / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
};

const cleanActor = (name) => {
  if (!name) return '';
  return name.replace(/\s*\([^)]*\)\s*$/, '').trim();
};

export const OrganJourneyTracker = ({
  organ,
  movements = [],
  sourceHospital,
  destinationHospital,
  compact = false,
  onNavigateDetail = null,
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

    let state = 'pending';
    if (m.key === 'donor_facility') {
      state = currentIdx === 0 ? 'current' : 'completed';
    } else if (idx < currentIdx) {
      state = movement ? 'completed' : 'no-record';
    } else if (idx === currentIdx) {
      state = organ.status === 'TRANSPLANTED' && m.key === 'transplanted' ? 'completed' : 'current';
    } else {
      state = 'pending';
    }

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
      location = srcName;
      duty = m.fallbackRole;
    } else if (m.key === 'destination_arrival') {
      location = dstName;
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

            return (
              <li
                key={stage.key}
                className={`journey-step-item step-${stage.state}`}
                aria-current={isCurrent ? 'step' : undefined}
              >
                <div className="journey-step-marker">
                  {isCompleted && <CheckCircle2 size={16} aria-hidden="true" className="marker-icon completed" />}
                  {isCurrent && <CircleDot size={16} aria-hidden="true" className="marker-icon current" />}
                  {isNoRecord && <Minus size={14} aria-hidden="true" className="marker-icon norecord" />}
                  {!isCompleted && !isCurrent && !isNoRecord && (
                    <Circle size={14} aria-hidden="true" className="marker-icon pending" />
                  )}
                </div>
                <div className="journey-step-content">
                  <span className="journey-step-label">{stage.label}</span>
                  <span className="journey-step-status-text">
                    {isCompleted ? 'Completed' : isCurrent ? 'Active Stage' : isNoRecord ? 'Logged' : 'Pending'}
                  </span>
                </div>
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
                <li key={item.key} className={`journey-log-item state-${item.state}`}>
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
                        {isPastOrCurrent ? 'Implicit transition' : 'Pending'}
                      </span>
                    )}
                  </div>

                  {/* Marker Node */}
                  <div className="journey-log-marker-col">
                    <div className={`journey-node node-${item.state}`}>
                      {item.state === 'completed' && <CheckCircle2 size={13} aria-hidden="true" />}
                      {item.state === 'current' && <CircleDot size={13} aria-hidden="true" />}
                      {item.state === 'pending' && <Circle size={10} aria-hidden="true" />}
                      {item.state === 'no-record' && <Minus size={11} aria-hidden="true" />}
                    </div>
                    {idx < milestonesWithData.length - 1 && <div className="journey-connector-line" />}
                  </div>

                  {/* Right Content Card */}
                  <div className="journey-log-card">
                    <div className="journey-card-top">
                      <span className="journey-card-heading">{item.label}</span>
                      <span className={`journey-state-pill pill-${item.state}`}>
                        {item.state === 'completed' ? 'Completed' : item.state === 'current' ? 'Current Stage' : item.state === 'no-record' ? 'Implicit' : 'Pending'}
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
