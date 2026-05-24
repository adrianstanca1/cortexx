export const APP_ROLE_TO_COMPANY_ROLE: Record<string, string> = {
  super_admin: "super_admin",
  company_owner: "company_admin",
  admin: "company_admin",
  project_manager: "manager",
  field_worker: "worker",
  subcontractor: "worker",
  client: "viewer",
};

export function toCompanyRole(role: string | null | undefined) {
  return APP_ROLE_TO_COMPANY_ROLE[role ?? ""] ?? "worker";
}
