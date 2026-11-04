export type SalesInquiryCategory = 'enterprise' | 'education_school' | 'education_university';

export interface SalesInquiryPayload {
  category: SalesInquiryCategory;
  email: string;
  first_name: string;
  job_title?: string;
  last_name: string;
  message?: string;
  organization_name: string;
  organization_size?: string;
  phone?: string;
  primary_use_case?: string;
  role_type?: string;
}

export interface SalesInquiryResponse {
  id?: number;
  message?: string;
  ok?: boolean;
}
