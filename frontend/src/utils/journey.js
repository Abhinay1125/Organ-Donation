export const JOURNEY_MILESTONES = [
  { key: 'donor_facility', label: 'Donor Hospital', movementStage: 'READY_FOR_RETRIEVAL', transitionStage: 'READY_FOR_RETRIEVAL', requiredRole: 'PROCUREMENT_ORGANIZER', fallbackRole: 'Procurement Organizer' },
  { key: 'retrieved', label: 'Organ Retrieved', movementStage: 'RETRIEVED', transitionStage: 'RETRIEVED', requiredRole: 'DONOR_SURGEON', fallbackRole: 'Donor Surgeon' },
  { key: 'packaged', label: 'Packaging', movementStage: 'PACKAGED', transitionStage: 'PACKAGED', requiredRole: 'DONOR_SURGEON', fallbackRole: 'Donor Surgeon' },
  { key: 'dispatched', label: 'Dispatched', movementStage: 'DISPATCHED', transitionStage: 'DISPATCHED', requiredRole: 'TRANSPORTER', fallbackRole: 'Transporter' },
  { key: 'transport', label: 'Transportation', movementStage: 'IN_TRANSIT', transitionStage: 'IN_TRANSIT', requiredRole: 'TRANSPORTER', fallbackRole: 'Transporter' },
  { key: 'destination_arrival', label: 'Destination Hospital', movementStage: 'DELIVERED', transitionStage: 'DELIVERED', requiredRole: 'TRANSPORTER', fallbackRole: 'Transporter' },
  { key: 'received', label: 'Received', movementStage: 'RECEIVED', transitionStage: 'RECEIVED', requiredRole: 'TRANSPLANT_SURGEON', fallbackRole: 'Transplant Surgeon' },
  { key: 'transplanted', label: 'Transplantation', movementStage: 'TRANSPLANTED', transitionStage: 'TRANSPLANTED', requiredRole: 'TRANSPLANT_SURGEON', fallbackRole: 'Transplant Surgeon' }
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

export const cleanActor = (name) => {
  if (!name) return '';
  return name.replace(/\s*\([^)]*\)\s*$/, '').trim();
};

