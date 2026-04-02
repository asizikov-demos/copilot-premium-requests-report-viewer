# Copilot Instructions

## Project Overview
This is a Next.js TypeScript application for analyzing CSV data containing user request analytics and quota information.

## Project Rules
- **ALWAYS use constants from `/src/constants/pricing.ts` instead of hardcoding pricing or quota values**

## Data Structure
The app ingests the expanded billing export. Core fields include:
```
date,username,product,sku,model,quantity,exceeds_quota,total_monthly_quota,applied_cost_per_quantity,gross_amount,discount_amount,net_amount,organization,cost_center_name
2026-03-11,userA,copilot,copilot_premium_request,Code Review model,2,TRUE,1000,0.04,0.08,0,0.08,example-org,APP-10009666 CostCenter 5900877
```
- Quota values can be `Unlimited`, `300`, or `1000`
- Billing fields may be absent in older datasets, so ingestion must handle optional commercial columns
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
