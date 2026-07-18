export type CivilStatus =
  | 'Single' | 'Married' | 'Widowed'
  | 'Legally Separated' | 'Annulled'

export type SexType = 'Male' | 'Female'

export type EducationalAttainment =
  | 'No Formal Education'
  | 'Elementary Undergraduate'
  | 'Elementary Graduate'
  | 'High School Undergraduate'
  | 'High School Graduate'
  | 'Senior High School Graduate'
  | 'Vocational / Tech-Voc'
  | 'College Undergraduate'
  | 'College Graduate'
  | 'Post Graduate'

export type EmploymentStatus =
  | 'Employed' | 'Self-Employed' | 'Unemployed'
  | 'Student' | 'Retired' | 'OFW'

export type UserRole =
  | 'super_admin' | 'captain' | 'secretary'
  | 'treasurer' | 'kagawad' | 'sk_official'
  | 'tanod' | 'encoder'

export type TanodStatus = 'Active' | 'Inactive' | 'Suspended' | 'Resigned'

export interface Purok {
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
}

export type HouseholdStatus = 'Active' | 'Vacant' | 'Demolished' | 'Transferred' | 'Condemned'

export interface Household {
  id: string
  household_number: string
  purok_id: string | null
  house_number: string | null
  street: string | null
  dwelling_type: string | null
  water_source: string | null
  toilet_facility: string | null
  is_4ps_beneficiary: boolean
  status: HouseholdStatus
  transferred_to: string | null
  status_changed_at: string | null
  status_changed_by: string | null
  status_remarks: string | null
  remarks: string | null
  created_at: string
  updated_at: string
  purok?: Purok
}

export interface Resident {
  id: string
  last_name: string
  first_name: string
  middle_name: string | null
  suffix: string | null
  date_of_birth: string
  place_of_birth: string | null
  sex: SexType
  civil_status: CivilStatus
  nationality: string
  religion: string | null
  contact_number: string | null
  email_address: string | null
  purok_id: string | null
  household_id: string | null
  house_number: string | null
  street: string | null
  educational_attainment: EducationalAttainment | null
  employment_status: EmploymentStatus | null
  occupation: string | null
  monthly_income: number | null
  voter_id_number: string | null
  philsys_number: string | null
  sss_number: string | null
  philhealth_number: string | null
  pagibig_number: string | null
  tin_number: string | null
  is_voter: boolean
  is_pwd: boolean
  pwd_id_number: string | null
  pwd_disability_type: string | null
  is_senior_citizen: boolean
  senior_citizen_id: string | null
  is_solo_parent: boolean
  solo_parent_id: string | null
  is_4ps_beneficiary: boolean
  is_indigent: boolean
  is_ofw: boolean
  household_role: string | null
  remarks: string | null
  is_deceased: boolean
  is_transferred: boolean
  created_at: string
  updated_at: string
  purok?: Purok
  household?: Household
}


export interface UserProfile {
  id: string
  full_name: string
  role: UserRole
  resident_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type OfficialPosition =
  | 'Punong Barangay'
  | 'Barangay Kagawad'
  | 'Barangay Secretary'
  | 'Barangay Treasurer'
  | 'SK Chairperson'
  | 'SK Kagawad'
  | 'SK Secretary'
  | 'SK Treasurer'


export interface BarangayOfficial {
  id: string
  resident_id: string | null
  full_name: string
  position: OfficialPosition
  committee: string | null
  term_start: string
  term_end: string
  is_active: boolean
  contact_number: string | null
  email_address: string | null
  signature_path: string | null
  remarks: string | null
  created_at: string
  updated_at: string
  resident?: any
}

export interface SKOfficial {
  id: string
  resident_id: string | null
  full_name: string
  position: string
  committee: string | null
  term_start: string
  term_end: string
  is_active: boolean
  contact_number: string | null
  email_address: string | null
  signature_path: string | null
  remarks: string | null
  created_at: string
  updated_at: string
}

export interface BarangayTanod {
  id: string
  resident_id: string | null
  full_name: string
  tanod_id_number: string
  status: TanodStatus
  date_appointed: string | null
  date_ended: string | null
  contact_number: string | null
  remarks: string | null
  created_at: string
  updated_at: string
}

export interface Committee {
  id: string
  name: string
  description: string | null
}

export type DocumentType =
  | 'Barangay Clearance'
  | 'Certificate of Residency'
  | 'Certificate of Indigency'
  | 'Certificate of Good Moral Character'
  | 'Certificate of No Income'
  | 'First-Time Jobseeker Certificate'
  | 'Business Clearance'

export type DocumentStatus = 'Issued' | 'Voided' | 'Reprinted'

export interface BarangaySettings {
  id: string
  barangay_name: string
  city: string
  province: string
  region: string
  zip_code: string | null
  contact_number: string | null
  email_address: string | null
  logo_path: string | null
  city_logo_path: string | null
  show_or_number: boolean
  updated_at: string
}

export interface DocumentTypeSettings {
  id: string
  document_type: DocumentType
  fee: number
  validity_months: number
  is_active: boolean
  notes: string | null
  updated_at: string
}

export interface IssuedDocument {
  id: string
  control_number: string
  document_type: DocumentType
  resident_id: string
  resident_name: string
  resident_address: string
  resident_age: number | null
  resident_civil_status: string | null
  purpose: string | null
  fee_paid: number
  or_number: string | null
  status: DocumentStatus
  validity_months: number
  issued_date: string
  expiry_date: string
  punong_barangay: string | null
  issued_by: string | null
  issued_by_name: string | null
  reprint_count: number
  last_reprint_at: string | null
  voided_at: string | null
  void_reason: string | null
  remarks: string | null
  created_at: string
  updated_at: string
  resident?: Resident
}

export type BlotterStatus =
  | 'Filed'
  | 'Summoned'
  | 'Mediation Scheduled'
  | 'Settled'
  | 'Referred to Court'
  | 'Dismissed'

export interface IncidentType {
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
}

export interface BlotterRecord {
  id: string
  blotter_number: string
  incident_type_id: string | null
  incident_type_name: string
  incident_date: string
  incident_time: string | null
  incident_place: string
  narrative: string
  witnesses: string | null
  evidence_remarks: string | null
  complainant_resident_id: string | null
  complainant_name: string
  complainant_address: string | null
  complainant_contact: string | null
  complainant_age: number | null
  complainant_civil_status: string | null
  respondents: string
  status: BlotterStatus
  summons_date: string | null
  summons_issued_by: string | null
  summons_control_number: string | null
  mediation_date: string | null
  mediation_time: string | null
  mediation_venue: string | null
  mediator_name: string | null
  resolution_date: string | null
  resolution_notes: string | null
  cfa_control_number: string | null
  settlement_control_number: string | null
  recorded_by_name: string | null
  punong_barangay: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type AnnouncementCategory =
  | 'General'
  | 'Health'
  | 'Safety'
  | 'Events'
  | 'Emergency'
  | 'Infrastructure'
  | 'Social Services'
  | 'Livelihood'

export type AnnouncementPriority =
  | 'Normal'
  | 'Urgent'
  | 'Emergency'

export interface Announcement {
  id: string
  title: string
  category: AnnouncementCategory
  priority: AnnouncementPriority
  content: string
  image_path: string | null
  is_published: boolean
  expiry_date: string | null
  posted_by_id: string | null
  posted_by_name: string | null
  posted_by_role: string | null
  created_at: string
  updated_at: string
}