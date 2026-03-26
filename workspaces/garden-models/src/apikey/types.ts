interface ValidateResult {
  createdAt: string;
  garden?: string;
  id: string;
  label: string;
  name: string;
  permissions: string[];
  scope: string;
  valid: true;
}

export type { ValidateResult };
