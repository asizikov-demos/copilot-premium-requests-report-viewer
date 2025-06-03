# Copilot Premium Requests Viewer

A Next.js application for analyzing CSV data containing user request analytics and quota information from GitHub Copilot Premium usage.

## Features

- **CSV Upload**: Drag-and-drop or click to upload CSV files
- **Data Validation**: Automatic validation of CSV structure and required columns
- **Analytics Dashboard**: 
  - Time frame analysis (first to last date)
  - Total unique users count
  - Users exceeding monthly quota count
  - Interactive chart showing total requests by model
  - Detailed data table

## Expected CSV Format

```csv
Timestamp,User,Model,Requests Used,Exceeds Monthly Quota,Total Monthly Quota
2025-06-03T11:05:27Z,userabc,gpt-4.1-2025-04-14,1.00,false,Unlimited
2025-06-03T11:03:55Z,userabc,gpt-4.1-2025-04-14,1.00,false,Unlimited
```

## Technologies Used

- **Next.js 15** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Recharts** for data visualization
- **PapaParse** for CSV parsing

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

4. Upload a CSV file using the provided interface

## Sample Data

A sample CSV file (`sample-data.csv`) is included in the project root for testing purposes.

## Project Structure

```
src/
├── app/
│   └── page.tsx          # Main application page
├── components/
│   ├── CSVUploader.tsx   # File upload component
│   └── DataAnalysis.tsx  # Analytics dashboard component
├── types/
│   └── csv.ts           # TypeScript type definitions
└── utils/
    └── dataAnalysis.ts  # Data processing utilities
```

## Development

- Components are built with accessibility and responsiveness in mind
- Error handling for file operations and data validation
- TypeScript interfaces for type safety
- Tailwind CSS for consistent styling

## License

MIT
