# Copilot Billing Report Viewer

Analyze GitHub Copilot AI Credit billing exports. See per-user consumption, quota tracking, model and token breakdowns, and billed costs — all processed locally in your browser.


## Cost Monitoring

Review billed net charges alongside monthly AI Credit consumption. The dashboard does not estimate Enterprise upgrade savings from request-unit pricing.

## Live Demo

Try the Sample Data option on the upload screen to see how it works without needing to upload your own report.

**Live App:** https://gh.io/pru-view

![Screenshot of the upload screen](readme/03-sample-data.png)

## Quick Start
1. Clone & install: `git clone ... && npm install`
2. Run: `npm run dev`
3. Open http://localhost:3000 and drag in your CSV


## Supported CSV Format

This application supports AI Credit rows in the GitHub Copilot expanded billing export format. A request-only export is rejected; in a mixed export, transitional premium-request rows are ignored so they cannot contaminate AI Credit totals.

### CSV Format
```csv
date,username,product,sku,model,quantity,unit_type,applied_cost_per_quantity,gross_amount,discount_amount,net_amount,total_monthly_quota,organization,repository,cost_center_name,aic_quantity,aic_gross_amount,input,output,cache_read,cache_write
2026-06-01,test-user-one,copilot,copilot_ai_credit,Claude Sonnet 4.5,21.36,ai-credits,0.01,0.2136,0.2136,0,3900,test-org-one,,test-cost-center-one,0,0,1420,590,175000,4200
```

**Minimum required columns:**
- `date` (YYYY-MM-DD UTC day; internally normalized to midnight UTC)
- `username`
- `model`
- `quantity`
- `unit_type` (`ai-credit` or `ai-credits`) or a recognized AI-credit `sku`

**Optional billing & organizational columns** (auto-detected when present):
- `applied_cost_per_quantity`, `gross_amount`, `discount_amount`, `net_amount`
- `total_monthly_quota`
- `product`, `sku`, `organization`, `repository`, `cost_center_name`
- `aic_quantity`, `aic_gross_amount`

Current Business and Enterprise monthly AI Credit quota values are defined in `src/constants/pricing.ts`. Commercial fields and token counts can be omitted; the viewer does not invent missing billed amounts.

### Optional token columns

The ingestion pipeline accepts `input`, `output`, `cache_read`, and `cache_write`.
It also accepts the respective compatibility aliases `total_input_tokens`,
`total_output_tokens`, `total_cache_read_tokens`, and `total_cache_creation_tokens`.
Token counts appear in the user detail **Daily Model Usage Breakdown** table when
the selected user's rows contain token data. Input, Output, Cache Write, and Cache
Read columns follow the table's date/model/cost-center grouping. Missing counts
display as `—`, explicit zeros as `0`, and incomplete sums are marked `(partial)`.
Reports without token data retain the existing table layout.
Token-bearing reports also show the daily breakdown when commercial fields are
absent; monetary columns are omitted rather than displayed as zero.

User details also include a **Token Usage Over Time** chart with a model selector,
a **Model Consumption Breakdown** with each model's share of reported AI Credits
and each token type. These use the selected billing period and user.
The model selector affects only the token chart. Token series are not stacked;
missing or incomplete daily counts leave gaps instead of plotting false zeros.
Shares use reported amounts only and are omitted when their denominator is zero.

Counts must be non-negative safe integers; CSV values must contain decimal digits
(surrounding whitespace is allowed). Missing or blank values remain absent, while
an explicit `0` remains a reported zero. A nonblank short-name field takes precedence
over its alias, even when invalid. Invalid counts and conflicting aliases are recorded
in ingestion warnings without dropping the billing row or counting both aliases.
Warnings remain in the ingestion result; this change adds no warning UI.
If a summed count exceeds JavaScript's safe integer range, token aggregation fails
with an ingestion warning and a `null` token artifact rather than rounded or partial
totals. Other ingestion artifacts remain available.
Subsequent rows skip the failed token accumulator, keeping its warnings bounded.

Token artifacts contain separate totals for each token type, per model, per named
user, per special usage bucket, and per UTC day. Each aggregate records its row count
and the number of valid reported values per token type so partial coverage is not
mistaken for a complete total. Unattributed usage contributes to overall/model/day
totals, not to a fabricated user. Billing-period filtering also filters token artifacts,
including when raw rows are not retained.

Token counts do not change AI Credits, quotas, or monetary calculations.
The pipeline does not infer costs or a combined total across token categories.

## What You Get
- Per-user AI credit breakdown with quota status
- Model usage distribution charts
- Reported additional-usage charges and AI Credit budget insights
- Daily/weekly usage trends

 **How to get this report**:

Expanded billing export from Copilot spending or enterprise usage dashboards. Refer to the official [GitHub Copilot usage and entitlements documentation](https://docs.github.com/en/enterprise-cloud@latest/copilot/managing-copilot/monitoring-usage-and-entitlements/monitoring-your-copilot-usage-and-entitlements).

## Privacy
All processing is client-side. No data leaves your browser.

## Contributing

Contributions are welcome! This is an open-source project designed to help teams analyze their Copilot usage effectively.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request


---

**Note**: This tool is not affiliated with GitHub. It's a community-created utility for analyzing Copilot usage reports.
