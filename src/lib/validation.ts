// ============================================================
// BMIS Input Validation & Sanitization
// Barangay IV, Tangub City, Misamis Occidental
// ============================================================

export type FieldErrors = Record<string, string>

// ============================================================
// SANITIZERS — strip invalid characters on keypress
// ============================================================

// Names only: letters, spaces, hyphens, apostrophes, periods
export function sanitizeName(value: string): string {
  return value.replace(/[^a-zA-ZÀ-ÿñÑ\s\-'\.]/g, '')
}

// House number: letters, numbers, hyphens, spaces only
export function sanitizeHouseNumber(value: string): string {
  return value.replace(/[^a-zA-Z0-9\-\s]/g, '')
}

// Street: letters, numbers, spaces, periods, commas, hyphens
export function sanitizeStreet(value: string): string {
  return value.replace(/[<>{}\"\'\/\\]/g, '')
}

// General text: block HTML injection characters
export function sanitizeText(value: string): string {
  return value.replace(/[<>{}\"\'\/\\]/g, '')
}

// Numbers only
export function sanitizeNumeric(value: string): string {
  return value.replace(/[^0-9.]/g, '')
}

// ============================================================
// FIELD VALIDATORS — called on blur (when leaving a field)
// ============================================================

export function validateRequired(value: string, label: string): string {
  if (!value || !value.trim()) return `${label} is required.`
  return ''
}

export function validateName(value: string, label: string, required = false): string {
  if (required && (!value || !value.trim())) return `${label} is required.`
  if (!value) return ''
  if (value.trim().length < 2) return `${label} must be at least 2 characters.`
  if (value.trim().length > 100) return `${label} must be 100 characters or less.`
  if (/[0-9]/.test(value)) return `${label} must not contain numbers.`
  if (/[<>{}\"\'\/\\@#$%^&*()_+=\[\]|;:,!?]/.test(value))
    return `${label} contains invalid characters.`
  return ''
}

export function validateContactNumber(value: string): string {
  if (!value || !value.trim()) return ''
  const cleaned = value.replace(/\s/g, '')
  if (!/^(09)\d{9}$/.test(cleaned))
    return 'Enter a valid PH mobile number starting with 09 (e.g. 09123456789).'
  return ''
}

export function validateEmail(value: string): string {
  if (!value || !value.trim()) return ''
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(value.trim()))
    return 'Enter a valid email address.'
  return ''
}

export function validateDateOfBirth(value: string): string {
  if (!value) return 'Date of birth is required.'

  const dob = new Date(value)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Block future dates
  if (dob >= today) return 'Date of birth cannot be a future date.'

  // Check realistic age (0 to 120)
  const age = today.getFullYear() - dob.getFullYear()
  const monthDiff = today.getMonth() - dob.getMonth()
  const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())
    ? age - 1
    : age

  if (actualAge > 120) return 'Please check the date — age exceeds 120 years.'
  if (actualAge < 0) return 'Invalid date of birth.'

  return ''
}

export function validateHouseNumber(value: string): string {
  if (!value) return ''
  if (value.length > 20) return 'House number must be 20 characters or less.'
  return ''
}

export function validateStreet(value: string): string {
  if (!value) return ''
  if (value.length > 100) return 'Street name must be 100 characters or less.'
  return ''
}

export function validateIncome(value: string): string {
  if (!value) return ''
  const num = parseFloat(value)
  if (isNaN(num)) return 'Monthly income must be a valid number.'
  if (num < 0) return 'Monthly income cannot be negative.'
  if (num > 10000000) return 'Please check the amount entered.'
  return ''
}

export function validateRemarks(value: string): string {
  if (!value) return ''
  if (value.length > 500) return `Remarks must be 500 characters or less. (${value.length}/500)`
  return ''
}

// ============================================================
// FULL FORM VALIDATOR — runs on Save
// ============================================================

export function validateResidentForm(form: any): FieldErrors {
  const errors: FieldErrors = {}

  const lastNameErr = validateName(form.last_name, 'Last name', true)
  if (lastNameErr) errors.last_name = lastNameErr

  const firstNameErr = validateName(form.first_name, 'First name', true)
  if (firstNameErr) errors.first_name = firstNameErr

  if (form.middle_name) {
    const middleErr = validateName(form.middle_name, 'Middle name')
    if (middleErr) errors.middle_name = middleErr
  }

  const dobErr = validateDateOfBirth(form.date_of_birth)
  if (dobErr) errors.date_of_birth = dobErr

  if (!form.sex) errors.sex = 'Sex is required.'
  if (!form.civil_status) errors.civil_status = 'Civil status is required.'

  const contactErr = validateContactNumber(form.contact_number)
  if (contactErr) errors.contact_number = contactErr

  const emailErr = validateEmail(form.email_address)
  if (emailErr) errors.email_address = emailErr

  const houseErr = validateHouseNumber(form.house_number)
  if (houseErr) errors.house_number = houseErr

  const streetErr = validateStreet(form.street)
  if (streetErr) errors.street = streetErr

  const incomeErr = validateIncome(form.monthly_income)
  if (incomeErr) errors.monthly_income = incomeErr

  const remarksErr = validateRemarks(form.remarks)
  if (remarksErr) errors.remarks = remarksErr

  return errors
}

export function validateHouseholdForm(form: any): FieldErrors {
  const errors: FieldErrors = {}

  if (!form.purok_id) errors.purok_id = 'Please select a purok.'

  const houseErr = validateHouseNumber(form.house_number)
  if (houseErr) errors.house_number = houseErr

  const streetErr = validateStreet(form.street)
  if (streetErr) errors.street = streetErr

  const remarksErr = validateRemarks(form.remarks)
  if (remarksErr) errors.remarks = remarksErr

  return errors
}

// ============================================================
// DUPLICATE CHECKER — called on blur of name/dob fields
// ============================================================

export async function checkDuplicateResident(
  supabase: any,
  lastName: string,
  firstName: string,
  dateOfBirth: string,
  excludeId?: string
): Promise<{ isDuplicate: boolean; matches: any[] }> {
  if (!lastName.trim() || !firstName.trim() || !dateOfBirth) {
    return { isDuplicate: false, matches: [] }
  }

  let query = supabase
    .from('residents')
    .select('id, first_name, last_name, middle_name, date_of_birth, purok_id')
    .ilike('last_name', lastName.trim())
    .ilike('first_name', firstName.trim())
    .eq('date_of_birth', dateOfBirth)
    .eq('is_deceased', false)
    .eq('is_transferred', false)

  if (excludeId) {
    query = query.neq('id', excludeId)
  }

  const { data } = await query
  return {
    isDuplicate: (data?.length ?? 0) > 0,
    matches: data ?? []
  }
}