"use client";
import React from 'react';
import { PowerUserScore } from '@/types/csv';
import { FullScreenModal } from '../primitives/FullScreenModal';
import { POWER_USER_SCORE_WEIGHTS } from '@/constants/powerUsers';

interface PowerUserScoreDialogProps {
  user: PowerUserScore | null;
  onClose: () => void;
}

export const PowerUserScoreDialog: React.FC<PowerUserScoreDialogProps> = ({ user, onClose }) => {
  if (!user) return null;
  return (
    <FullScreenModal open={!!user} onClose={onClose} title={`Power User Score Breakdown: ${user.user}`}>      
      <div className="space-y-6 max-w-5xl mx-auto" aria-live="polite">
        <section className="bg-gray-50 p-4 rounded-lg" aria-labelledby="score-total-heading">
          <div className="flex justify-between items-center mb-2">
            <h3 id="score-total-heading" className="font-medium text-gray-700">Total Score</h3>
            <span className="text-2xl font-bold text-blue-600" aria-label={`Total score ${user.totalScore} out of 100`}>{user.totalScore}/100</span>
          </div>
          <p className="text-sm text-gray-700">Based on {Math.round(user.totalRequests * 100) / 100} total requests</p>
        </section>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section aria-labelledby="score-components-heading" className="space-y-4">
            <h4 id="score-components-heading" className="font-medium text-gray-900">Score Components</h4>
            <div className="bg-white rounded-lg shadow-sm p-4 space-y-3">
              <ScoreRow label={`Model Diversity (${POWER_USER_SCORE_WEIGHTS.diversity}%)`} value={user.breakdown.diversityScore} max={POWER_USER_SCORE_WEIGHTS.diversity} />
              <ScoreRow label={`Special Features (${POWER_USER_SCORE_WEIGHTS.specialFeatures}%)`} value={user.breakdown.specialFeaturesScore} max={POWER_USER_SCORE_WEIGHTS.specialFeatures} />
              <ScoreRow label={`Vision Models (${POWER_USER_SCORE_WEIGHTS.vision}%)`} value={user.breakdown.visionScore} max={POWER_USER_SCORE_WEIGHTS.vision} />
              <ScoreRow label={`Balance Score (${POWER_USER_SCORE_WEIGHTS.balance}%)`} value={user.breakdown.balanceScore} max={POWER_USER_SCORE_WEIGHTS.balance} />
            </div>
          </section>
          <section aria-labelledby="model-usage-heading" className="space-y-4">
            <h4 id="model-usage-heading" className="font-medium text-gray-900">Model Usage</h4>
            <div className="bg-white rounded-lg shadow-sm p-4 space-y-3">
              <UsageRow label="Unique Models" value={user.modelUsage.uniqueModels} />
              <UsageRow label="Light Models" value={user.modelUsage.light} />
              <UsageRow label="Medium Models" value={user.modelUsage.medium} />
              <UsageRow label="Heavy Models" value={user.modelUsage.heavy} />
              <UsageRow label="Special Features" value={user.modelUsage.special} />
              <UsageRow label="Vision Models" value={user.modelUsage.vision} />
            </div>
          </section>
        </div>
      </div>
    </FullScreenModal>
  );
};

const ScoreRow: React.FC<{ label: string; value: number; max: number; }> = ({ label, value, max }) => (
  <div className="flex justify-between items-center">
    <span className="text-sm text-gray-600">{label}</span>
    <span className="font-medium text-gray-800" aria-label={`${label} ${value} out of ${max}`}>{value}/{max}</span>
  </div>
);

const UsageRow: React.FC<{ label: string; value: number | string; }> = ({ label, value }) => (
  <div className="flex justify-between items-center">
    <span className="text-sm text-gray-600">{label}</span>
    <span className="font-medium text-gray-800" aria-label={`${label} ${value}`}>{value}</span>
  </div>
);
