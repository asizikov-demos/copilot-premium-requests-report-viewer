export const invalidCSVData = {
  missingColumns: `date,username,model
2025-06-03,test-user-a,gpt-4.1-2025-04-14`,
  
  emptyFile: '',
  
  malformedData: `date,username,sku,unit_type,model,quantity,total_monthly_quota
2025-06-03,test-user-one,copilot_ai_credit,ai-credits,gpt-4.1-2025-04-14,invalid_number,Unknown`,
  
  invalidDate: `date,username,sku,unit_type,model,quantity,total_monthly_quota
invalid-date,test-user-one,copilot_ai_credit,ai-credits,gpt-4.1-2025-04-14,1.00,Unknown`,

  missingRequiredColumns: `username,model,quantity
test-user-one,gpt-4.1-2025-04-14,1.00`,

  extraColumns: `date,username,sku,unit_type,model,quantity,total_monthly_quota,extra_column
2025-06-03,test-user-one,copilot_ai_credit,ai-credits,gpt-4.1-2025-04-14,1.00,Unknown,extra_value`,

  unsupportedRequestUnits: `date,username,sku,unit_type,model,quantity,total_monthly_quota
2025-06-03,test-user-one,copilot_premium_request,requests,gpt-4.1-2025-04-14,1.00,Unknown`
};
