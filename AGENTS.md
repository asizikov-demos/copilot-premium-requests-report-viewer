# Copilot Instructions

## Project Overview
This is a Next.js TypeScript application for analyzing CSV data containing AI Credit usage, token breakdowns, and quota information.

## Project Rules
- **ALWAYS use constants from `/src/constants/pricing.ts` instead of hardcoding pricing or quota values**

## Data Structure
The app ingests the expanded billing export. Core fields include:
```
date,username,product,sku,model,quantity,unit_type,applied_cost_per_quantity,gross_amount,discount_amount,net_amount,total_monthly_quota,organization,repository,cost_center_name,aic_quantity,aic_gross_amount,input,output,cache_read,cache_write
2026-06-11,test-user-one,copilot,copilot_ai_credit,Code Review model,2.5,ai-credits,0.01,0.025,0.025,0,1900,test-org-one,,test-cost-center-one,0,0,100,50,1000,0
```
- Recognized AI Credit quota values are `1900` and `3900`; other values are unknown
- Request-only reports are rejected; mixed reports ignore transitional request-unit rows
- Billing fields may be absent in token-only exports, so ingestion must handle optional commercial columns
- Organization and cost center fields are supported throughout the app

## Date Handling - CRITICAL
**NEVER convert dates to local timezone.** This is a billing report and date accuracy is crucial:
- Always treat the CSV date/timestamp exactly as provided
- If a timestamp says "June 30th, 2025 at 23:59:59Z", it should be treated as June 30th, 2025
- Billing periods start on the 1st day of the month and end on the last day of the month
- Use UTC dates consistently throughout the application
- When grouping by months/days, use the exact date from the timestamp without timezone conversion

## Git Workflow
When it's time to commit, push, create or update a PR, or clean up after a merge, delegate to the `git-workflow` skill (`.github/skills/git-workflow/SKILL.md`).
