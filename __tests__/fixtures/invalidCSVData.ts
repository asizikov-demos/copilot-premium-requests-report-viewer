export const invalidCSVData = {
  missingColumns: `Timestamp,User,Model
2025-06-03T11:05:27Z,TJGriff,gpt-4.1-2025-04-14`,
  
  emptyFile: '',
  
  malformedData: `Timestamp,User,Model,Requests Used,Exceeds Monthly Quota,Total Monthly Quota
2025-06-03T11:05:27Z,TJGriff,gpt-4.1-2025-04-14,invalid_number,false,Unlimited`,
  
  invalidTimestamp: `Timestamp,User,Model,Requests Used,Exceeds Monthly Quota,Total Monthly Quota
invalid-timestamp,TJGriff,gpt-4.1-2025-04-14,1.00,false,Unlimited`,

  missingRequiredColumns: `User,Model,Requests Used
TJGriff,gpt-4.1-2025-04-14,1.00`,

  extraColumns: `Timestamp,User,Model,Requests Used,Exceeds Monthly Quota,Total Monthly Quota,Extra Column
2025-06-03T11:05:27Z,TJGriff,gpt-4.1-2025-04-14,1.00,false,Unlimited,extra_value`,

  invalidBooleanValues: `Timestamp,User,Model,Requests Used,Exceeds Monthly Quota,Total Monthly Quota
2025-06-03T11:05:27Z,TJGriff,gpt-4.1-2025-04-14,1.00,maybe,Unlimited`
};
