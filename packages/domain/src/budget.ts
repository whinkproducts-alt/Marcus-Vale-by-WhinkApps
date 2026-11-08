// Budget and usage tracking types for Marcosville
export interface Budget {
  id: string;
  userId: string;
  month: string; // "2024-01", "2024-02"
  totalBudget: number;
  usedBudget: number;
  overageBudget: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UsageEvent {
  id: string;
  userId: string;
  modelName: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  usageTimestamp: Date;
  purpose?: string;
}

export interface BudgetPort {
  getBudget(userId: string, month: string): Promise<Budget | null>;
  createBudget(budget: Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>): Promise<Budget>;
  updateBudgetUsage(userId: string, month: string, cost: number, model: string, provider: string): Promise<Budget>;
  getBudgetUsage(userId: string, month: string): Promise<{ used: number; overage: number; remaining: number }>;
  checkBudgetLimit(userId: string, month: string): Promise<{ underLimit: boolean; usagePercentage: number; remainingBudget: number }>;
}

export interface UsageTrackingPort {
  recordUsageEvent(event: Omit<UsageEvent, 'id'>): Promise<UsageEvent>;
  getUsageEvents(userId: string, startDate?: Date, endDate?: Date): Promise<UsageEvent[]>;
  getUsageSummary(userId: string, period: 'day' | 'week' | 'month'): Promise<{ totalCost: number; totalTokens: number; averageCostPerToken: number }>;
}
