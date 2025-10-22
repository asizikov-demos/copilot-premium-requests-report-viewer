export const invalidCSVData = {
  missingColumns: `date,username,model
2025-06-03,USerA,gpt-4.1-2025-04-14`,
  
  emptyFile: '',
  
  malformedData: `date,username,model,quantity,exceeds_quota,total_monthly_quota
2025-06-03,USerA,gpt-4.1-2025-04-14,invalid_number,false,Unlimited`,
  
  invalidDate: `date,username,model,quantity,exceeds_quota,total_monthly_quota
invalid-date,USerA,gpt-4.1-2025-04-14,1.00,false,Unlimited`,

  missingRequiredColumns: `username,model,quantity
USerA,gpt-4.1-2025-04-14,1.00`,

  extraColumns: `date,username,model,quantity,exceeds_quota,total_monthly_quota,extra_column
2025-06-03,USerA,gpt-4.1-2025-04-14,1.00,false,Unlimited,extra_value`,

  invalidBooleanValues: `date,username,model,quantity,exceeds_quota,total_monthly_quota
2025-06-03,USerA,gpt-4.1-2025-04-14,1.00,maybe,Unlimited`
};
