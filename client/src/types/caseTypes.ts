export interface PasskeyItem {
  id: number;
  emp_name: string;
  password: string;
  role: string;
}

export interface Patient {
  patientName?: string;
  status?: string;
}

export interface LiveCaseItem {
  caseId: string;
  token: string;
  caseOwner: string;
  caseStatus?: string;
  patients?: Patient[];
}

export interface RedesignItem {
  caseId: string;
  attempt: number;
  caseOwner: string;
  patients?: Patient[];
  priority: string;
}

export interface RedesignSeletedItem {
  caseId: string;
  attempt: number;
  caseOwner: string;
  patientName: string;
  priority?: string;
  activeDate: string;
  key: string;
}

export interface RedesignCaseTableProps {
  data: RedesignItem[];
  activeDate: string | null;
  activeToken: string | null;
  onRefresh?: () => void;
  passwords : string[]
}

export interface LiveCaseTableProps {
  data: Record<string, Record<string, LiveCaseItem[]>>;
  activeDate: string | null;
  activeToken: string | null;
  onRefresh?: () => void;
  passwords : string[]
}

export interface UploadResult {
  caseId: string;
  patientName: string;
  status: "uploaded" | "failed" | "uploading" | string;
}

export interface UploadResponse {
  results: UploadResult[];
}
