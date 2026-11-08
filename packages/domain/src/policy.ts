// Policy types for Marcosville
export type PolicyClass = 'A' | 'B' | 'C';

export interface Policy {
  id: string;
  name: string;
  description: string;
  policyClass: PolicyClass;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PolicyAssignment {
  id: string;
  userId: string;
  policyId: string;
  assignmentType: 'mission' | 'scope' | 'exception';
  assignmentData: any;
  isActive: boolean;
  grantedAt: Date;
  expiresAt?: Date;
  grantedBy?: string;
}

export interface PolicyPort {
  getPolicy(id: string): Promise<Policy | null>;
  assignPolicyToUser(assignment: Omit<PolicyAssignment, 'id' | 'grantedAt'>): Promise<PolicyAssignment>;
  getUserPolicies(userId: string): Promise<PolicyAssignment[]>;
  validatePolicyForUser(userId: string, policyClass: PolicyClass): Promise<boolean>;
}
