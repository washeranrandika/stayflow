/**
 * StayFlow - Identity Verification & Decoding Utilities
 * Validates National ID (NIC), Passport, and Driving License.
 * Automatically decodes Date of Birth, Gender, and Age from NIC numbers.
 */

export type IdType = "NATIONAL_ID" | "PASSPORT" | "DRIVING_LICENSE" | "OTHER";

export interface DecodedIdInfo {
  isValid: boolean;
  idType: IdType;
  formattedId: string;
  errorMessage?: string;
  dob?: string; // YYYY-MM-DD
  dobFormatted?: string; // e.g. "03 May 1998"
  gender?: "Male" | "Female";
  age?: number;
  year?: number;
  isOldNic?: boolean;
  isNewNic?: boolean;
}

const MONTH_DAYS = [
  { month: "January", code: "01", days: 31 },
  { month: "February", code: "02", days: 29 }, // Sri Lanka NIC system treats Feb as 29
  { month: "March", code: "03", days: 31 },
  { month: "April", code: "04", days: 30 },
  { month: "May", code: "05", days: 31 },
  { month: "June", code: "06", days: 30 },
  { month: "July", code: "07", days: 31 },
  { month: "August", code: "08", days: 31 },
  { month: "September", code: "09", days: 30 },
  { month: "October", code: "10", days: 31 },
  { month: "November", code: "11", days: 30 },
  { month: "December", code: "12", days: 31 },
];

/**
 * Calculates Month and Day from day of year (1-366)
 */
function getMonthAndDay(dayOfYear: number): { monthName: string; monthNum: string; day: number } | null {
  let remainingDays = dayOfYear;
  for (const m of MONTH_DAYS) {
    if (remainingDays <= m.days) {
      return {
        monthName: m.month,
        monthNum: m.code,
        day: remainingDays,
      };
    }
    remainingDays -= m.days;
  }
  return null;
}

/**
 * Validates and decodes a National Identity Card (NIC) number (Old 9+V/X or New 12 digits).
 */
export function validateAndDecodeNIC(rawId: string): DecodedIdInfo {
  const clean = rawId.trim().toUpperCase();

  if (!clean) {
    return {
      isValid: false,
      idType: "NATIONAL_ID",
      formattedId: clean,
      errorMessage: "ID number is required",
    };
  }

  let year: number;
  let dayOfYear: number;
  let isOldNic = false;
  let isNewNic = false;

  // 1. Old NIC format: 9 digits + V or X (e.g. 981234567V)
  const oldNicMatch = clean.match(/^([0-9]{9})([VX])$/);
  // 2. New NIC format: 12 digits (e.g. 199812345678)
  const newNicMatch = clean.match(/^([0-9]{12})$/);

  if (oldNicMatch) {
    isOldNic = true;
    const digits = oldNicMatch[1];
    const yy = parseInt(digits.substring(0, 2), 10);
    // Assume 1900s for old NIC
    year = 1900 + yy;
    dayOfYear = parseInt(digits.substring(2, 5), 10);
  } else if (newNicMatch) {
    isNewNic = true;
    year = parseInt(clean.substring(0, 4), 10);
    dayOfYear = parseInt(clean.substring(4, 7), 10);

    const currentYear = new Date().getFullYear();
    if (year < 1900 || year > currentYear) {
      return {
        isValid: false,
        idType: "NATIONAL_ID",
        formattedId: clean,
        errorMessage: `Invalid birth year: ${year}`,
      };
    }
  } else {
    // If user is partially typing, check length
    if (clean.length < 9) {
      return {
        isValid: false,
        idType: "NATIONAL_ID",
        formattedId: clean,
        errorMessage: "National ID must be 10 characters (e.g. 981234567V) or 12 digits",
      };
    }
    return {
      isValid: false,
      idType: "NATIONAL_ID",
      formattedId: clean,
      errorMessage: "Invalid NIC format. Use 9 digits + V (e.g., 981234567V) or 12 digits (e.g., 199812345678)",
    };
  }

  // Determine Gender and Day Count
  let gender: "Male" | "Female" = "Male";
  let adjustedDays = dayOfYear;

  if (dayOfYear > 500) {
    gender = "Female";
    adjustedDays = dayOfYear - 500;
  }

  if (adjustedDays < 1 || adjustedDays > 366) {
    return {
      isValid: false,
      idType: "NATIONAL_ID",
      formattedId: clean,
      errorMessage: `Invalid day count (${dayOfYear}) encoded in NIC`,
    };
  }

  const dateResult = getMonthAndDay(adjustedDays);
  if (!dateResult) {
    return {
      isValid: false,
      idType: "NATIONAL_ID",
      formattedId: clean,
      errorMessage: "Could not decode birth date from ID",
    };
  }

  const dayStr = dateResult.day < 10 ? `0${dateResult.day}` : `${dateResult.day}`;
  const dobIso = `${year}-${dateResult.monthNum}-${dayStr}`;
  const dobFormatted = `${dayStr} ${dateResult.monthName} ${year}`;

  // Calculate approximate age
  const today = new Date();
  let age = today.getFullYear() - year;
  const birthDate = new Date(year, parseInt(dateResult.monthNum, 10) - 1, dateResult.day);
  if (
    today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }

  return {
    isValid: true,
    idType: "NATIONAL_ID",
    formattedId: clean,
    dob: dobIso,
    dobFormatted,
    gender,
    age: Math.max(0, age),
    year,
    isOldNic,
    isNewNic,
  };
}

/**
 * Validates Passport format
 */
export function validatePassport(rawId: string): DecodedIdInfo {
  const clean = rawId.trim().toUpperCase();
  if (!clean) {
    return {
      isValid: false,
      idType: "PASSPORT",
      formattedId: clean,
      errorMessage: "Passport number is required",
    };
  }

  // Standard passport: 1-2 letters followed by 6-9 numbers/alphanumerics
  const passportRegex = /^[A-Z]{1,2}[0-9]{6,9}$|^[A-Z0-9]{7,10}$/;
  if (!passportRegex.test(clean)) {
    return {
      isValid: false,
      idType: "PASSPORT",
      formattedId: clean,
      errorMessage: "Passport number should be 7-10 characters (e.g. N1234567)",
    };
  }

  return {
    isValid: true,
    idType: "PASSPORT",
    formattedId: clean,
  };
}

/**
 * Validates Driving License format
 */
export function validateDrivingLicense(rawId: string): DecodedIdInfo {
  const clean = rawId.trim().toUpperCase();
  if (!clean) {
    return {
      isValid: false,
      idType: "DRIVING_LICENSE",
      formattedId: clean,
      errorMessage: "Driving license number is required",
    };
  }

  const dlRegex = /^[A-Z0-9]{6,12}$/;
  if (!dlRegex.test(clean)) {
    return {
      isValid: false,
      idType: "DRIVING_LICENSE",
      formattedId: clean,
      errorMessage: "Driving license should be 6-12 alphanumeric characters",
    };
  }

  return {
    isValid: true,
    idType: "DRIVING_LICENSE",
    formattedId: clean,
  };
}

/**
 * Unified verification function based on ID Type
 */
export function validateGuestId(idType: string, idNumber: string): DecodedIdInfo {
  const clean = (idNumber || "").trim().toUpperCase();
  if (!clean) {
    return {
      isValid: false,
      idType: (idType as IdType) || "NATIONAL_ID",
      formattedId: "",
    };
  }

  switch (idType) {
    case "NATIONAL_ID":
      return validateAndDecodeNIC(clean);
    case "PASSPORT":
      return validatePassport(clean);
    case "DRIVING_LICENSE":
      return validateDrivingLicense(clean);
    default:
      return {
        isValid: clean.length >= 4,
        idType: "OTHER",
        formattedId: clean,
        errorMessage: clean.length < 4 ? "ID number too short" : undefined,
      };
  }
}
