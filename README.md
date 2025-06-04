# GitHub Copilot Premium Requests Viewer

A Next.js application for analyzing CSV data containing user request analytics and quota information from GitHub Copilot Premium Models usage reports. This tool provides detailed insights into usage patterns, quota consumption, and cost analysis.

## ✨ Features

### 📊 **Analytics Dashboard**
- **Usage Statistics**: Total unique users and quota violations
- **Interactive Charts**: Bar charts showing requests by model
- **Detailed Data Tables**: Complete breakdown of all usage data

### 👥 **User Overview & Analysis**
- **Individual User Breakdown**: Detailed per-user request analysis
- **Model Usage Patterns**: See which models each user prefers
- **Quota Monitoring**: Identify users exceeding monthly limits
- **Cumulative Usage Charts**: Daily cumulative request tracking with quota reference lines
- **Sortable Tables**: Sort by total requests or specific models
- **Mobile-Optimized Views**: Responsive design with mobile-friendly charts and tables

### 💰 **Cost Analysis**
- **Plan Comparison**: Support for Copilot Business (300 requests/month) and Enterprise (1000 requests/month)
- **Overage Calculations**: Automatic calculation of excess usage costs at $0.04 per request
- **Cost Indication**: Dynamic cost calculations based on selected plan

### 📱 **User Experience**
- **Drag-and-Drop Upload**: Easy CSV file uploading
- **Data Validation**: Automatic CSV structure validation
- **Error Handling**: Comprehensive error messages and validation
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- **Privacy-First**: All processing happens locally in your browser

### 🔒 **Privacy & Security**
- **Client-Side Only**: No data ever leaves your browser
- **No External Servers**: All processing happens locally
- **Open Source**: Full source code available for review
- **Zero Data Collection**: No tracking, analytics, or data storage

## 📋 Expected CSV Format

The application expects CSV files with the following structure:

```csv
Timestamp,User,Model,Requests Used,Exceeds Monthly Quota,Total Monthly Quota
2025-06-03T11:05:27Z,userabc,gpt-4.1-2025-04-14,1.00,false,Unlimited
2025-06-03T11:03:55Z,userabc,gpt-4.1-2025-04-14,1.00,false,Unlimited
```

### Required Columns:
- **Timestamp**: ISO 8601 formatted datetime
- **User**: Username or identifier
- **Model**: AI model used (e.g., gpt-4.1-2025-04-14)
- **Requests Used**: Number of requests (decimal format)
- **Exceeds Monthly Quota**: Boolean flag (true/false)
- **Total Monthly Quota**: Quota limit (e.g., "Unlimited", "300")

📖 **How to obtain this report**: See the [GitHub Copilot usage and entitlements documentation](https://docs.github.com/en/enterprise-cloud@latest/copilot/managing-copilot/monitoring-usage-and-entitlements/monitoring-your-copilot-usage-and-entitlements).

## 🛠️ Technologies Used

- **Next.js 15** with App Router
- **TypeScript** for comprehensive type safety
- **Tailwind CSS** for modern, responsive styling
- **Recharts** for interactive data visualizations
- **PapaParse** for robust CSV parsing

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. **Clone the repository**:
```bash
git clone https://github.com/asizikov-demos/copilot-premium-requests-report-viewer.git
cd copilot-premium-requests-report-viewer
```

2. **Install dependencies**:
```bash
npm install
```

3. **Run the development server**:
```bash
npm run dev
```

4. **Open your browser**:
Navigate to [http://localhost:3000](http://localhost:3000)

5. **Upload your CSV file**:
Use the drag-and-drop interface or click to browse for your Copilot usage report

### Building for Production

```bash
npm run build
npm start
```

## 📁 Project Structure

```
src/
├── app/
│   └── page.tsx              # Main application entry point
├── components/
│   ├── CSVUploader.tsx       # File upload with validation
│   ├── DataAnalysis.tsx      # Main analytics dashboard
│   └── UsersOverview.tsx     # Detailed user analysis view
├── types/
│   └── csv.ts               # TypeScript type definitions
└── utils/
    └── dataAnalysis.ts      # Data processing and analysis utilities
```

## 🔍 Key Analysis Features

### Dashboard Overview
- **Summary Statistics**: Key metrics at a glance
- **Model Usage**: Visual breakdown of requests by AI model
- **Time Period**: Automatic detection of report date range
- **Plan Selection**: Choose between Business and Enterprise plans

### User Analysis
- **Individual Breakdown**: Per-user request totals and model preferences
- **Quota Tracking**: Visual indicators for users exceeding limits
- **Cumulative Charts**: Daily usage progression with quota reference lines
- **Cost Calculations**: Real-time overage cost calculations
- **Sortable Data**: Interactive tables with sorting capabilities

### Mobile Experience
- **Responsive Charts**: Optimized visualizations for small screens
- **Collapsible Sections**: Space-efficient mobile navigation
- **Touch-Friendly**: Optimized for mobile interaction
- **Summary Cards**: Condensed information for mobile viewing

## 🔐 Privacy Information

This application prioritizes your data privacy:

- **🏠 Local Processing**: All CSV analysis happens in your browser
- **🚫 No Data Transfer**: Nothing is sent to external servers
- **🔓 Open Source**: Full source code available for audit
- **📵 No Tracking**: No analytics, cookies, or data collection
- **🛡️ Secure**: Your usage data never leaves your device

## 🤝 Contributing

Contributions are welcome! This is an open-source project designed to help teams analyze their Copilot usage effectively.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - Feel free to use, modify, and distribute as needed.

---

**Note**: This tool is not affiliated with GitHub. It's a community-created utility for analyzing Copilot usage reports.
