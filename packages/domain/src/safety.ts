// Safety types for Marcosville
export type SafetyState = 'normal' | 'lockdown' | 'restricted';

export interface SafetyEpoch {
  id: string;
  state: SafetyState;
  triggeredAt: Date;
  triggeredBy: string;
  reason?: string;
  expiresAt?: Date;
  isActive: boolean;
}

export interface SafetyPort {
  getCurrentSafetyState(userId: string): Promise<SafetyState>;
  setSafetyEpoch(epoch: Omit<SafetyEpoch, 'id'>): Promise<SafetyEpoch>;
  getSafetyHistory(userId: string, limit?: number): Promise<SafetyEpoch[]>;
  isActionAllowed(userId: string, action: string, context?: any): Promise<boolean>;
  validateSafetyForOperation(userId: string, operation: string, data?: any): Promise<{ allowed: boolean; reason?: string }>;
}

export interface SafetyPolicy {
  validateUserAction(userId: string, action: string, data?: any): Promise<{ safe: boolean; riskLevel?: 'low' | 'medium' | 'high'; reason?: string }>;
  checkSafetyEpochs(userId: string): Promise<SafetyEpoch[]>;
  enforceSafetyLockdown(userId: string, reason: string): Promise<void>;
}
