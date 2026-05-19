import {
  CLINIC_CLOSE_HOUR,
  CLINIC_OPEN_HOUR,
  CLINIC_TIMEZONE,
  getClinicHoursMessage,
  getManilaClock,
  isWithinClinicHours,
} from '../accessControl.js';

export {
  CLINIC_CLOSE_HOUR,
  CLINIC_OPEN_HOUR,
  CLINIC_TIMEZONE,
  getClinicHoursMessage,
  getManilaClock,
  isWithinClinicHours,
};

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;

export const getLockoutMessage = (lockedUntilIso, now = new Date()) => {
  const lockedUntil = new Date(lockedUntilIso);
  if (Number.isNaN(lockedUntil.getTime())) {
    return 'Account is temporarily locked. Please try again later.';
  }

  const remainingMs = lockedUntil.getTime() - now.getTime();
  const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
  return `Too many failed login attempts. Try again in ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}.`;
};
