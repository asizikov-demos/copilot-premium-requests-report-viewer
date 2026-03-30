'use client';

import React from 'react';

import { UserConsumptionModalProps } from '@/types/csv';
import { FullScreenModal } from './primitives/FullScreenModal';
import { UserDetailsView } from './UserDetailsView';

export function UserConsumptionModal({
  user,
  processedData,
  userQuotaValue,
  onClose
}: UserConsumptionModalProps) {
  return (
    <FullScreenModal
      open={true}
      onClose={onClose}
      title={`${user} Daily Usage`}
      contentClassName="flex flex-col"
    >
      <div className="flex-1 p-4">
        <UserDetailsView
          user={user}
          processedData={processedData}
          userQuotaValue={userQuotaValue}
          onBack={onClose}
        />
      </div>
    </FullScreenModal>
  );
}
