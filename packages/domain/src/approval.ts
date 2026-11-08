// Approval types for Marcosville
import type { PolicyClass } from './policy';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';
export type TargetType = 'task' | 'expense' | 'deployment' | 'policy';

export interface ApprovalRequest {
  id: string;
  requestId: string; // Content hash + timestamp
  userId: string;
  targetType: TargetType;
  targetId: string;
  action: 'approve' | 'reject' | 'delegate' | 'cancel';
  reason?: string;
  evidenceHash?: string;
  status: ApprovalStatus;
  createdAt: Date;
  expiresAt: Date;
  decidedAt?: Date;
}

export interface ApprovalDecision {
  id: string;
  approvalId: string;
  userId: string;
  action: 'approve' | 'reject' | 'delegate' | 'cancel';
  reason?: string;
  decisionAt: Date;
}

export interface ApprovalPort {
  createApproval(request: Omit<ApprovalRequest, 'id' | 'status' | 'createdAt'>): Promise<ApprovalRequest>;
  getApproval(id: string): Promise<ApprovalRequest | null>;
  decideApproval(decision: Omit<ApprovalDecision, 'id' | 'decisionAt'>): Promise<ApprovalRequest>;
  getUserApprovals(userId: string, status?: ApprovalStatus): Promise<ApprovalRequest[]>;
  validateApprovalAccess(userId: string, approvalId: string): Promise<boolean>;
}

export interface ApprovalPolicy {
  requiresApproval(action: string, targetType: string, userId: string, data?: any): Promise<boolean>;
  getRequiredPolicyClass(action: string, targetType: string): Promise<PolicyClass>;
  checkApprovalWindow(approvalId: string): Promise<boolean>;
}
