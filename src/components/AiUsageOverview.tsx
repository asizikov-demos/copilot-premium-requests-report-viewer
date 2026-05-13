'use client';

import { useAnalysisContext } from '@/context/AnalysisContext';

import { UsersAicClustersChart } from './charts/UsersAicClustersChart';

export function AiUsageOverview() {
  const { billingArtifacts } = useAnalysisContext();

  if (!billingArtifacts?.hasAnyAicData) {
    return (
      <div className="w-full space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-[#1f2328]">AI Usage</h2>
          <p className="text-sm text-[#636c76] mt-1">
            AI Credits data is not available for the selected report.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-[#1f2328]">AI Usage</h2>
        <p className="text-sm text-[#636c76] mt-1">
          AI Credits consumption patterns across users, measured in USD gross usage.
        </p>
      </div>

      <div className="bg-white border border-[#d1d9e0] rounded-md overflow-hidden">
        <div className="px-5 py-4 border-b border-[#d1d9e0]">
          <h3 className="text-sm font-medium text-[#1f2328]">AI Credits User Clusters</h3>
          <p className="text-xs text-[#636c76] mt-0.5">
            Typical user groups by AI Credits gross consumption in USD
          </p>
        </div>
        <div className="p-5">
          <UsersAicClustersChart users={billingArtifacts.users} />
        </div>
      </div>
    </div>
  );
}
