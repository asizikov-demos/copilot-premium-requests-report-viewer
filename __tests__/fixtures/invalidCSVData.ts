export const invalidCSVData = {
  missingColumns: `date,username,model
2025-06-03,test-user-a,gpt-4.1-2025-04-14`,
  
  emptyFile: '',
  
  malformedData: `date,username,model,quantity,exceeds_quota,total_monthly_quota
2025-06-03,test-user-a,gpt-4.1-2025-04-14,invalid_number,false,Unknown`,
  
  invalidDate: `date,username,model,quantity,exceeds_quota,total_monthly_quota
invalid-date,test-user-a,gpt-4.1-2025-04-14,1.00,false,Unknown`,

  missingRequiredColumns: `username,model,quantity
test-user-a,gpt-4.1-2025-04-14,1.00`,

  extraColumns: `date,username,model,quantity,exceeds_quota,total_monthly_quota,extra_column
2025-06-03,test-user-a,gpt-4.1-2025-04-14,1.00,false,Unknown,extra_value`,

  invalidBooleanValues: `date,username,model,quantity,exceeds_quota,total_monthly_quota
2025-06-03,test-user-a,gpt-4.1-2025-04-14,1.00,maybe,Unknown`
};
