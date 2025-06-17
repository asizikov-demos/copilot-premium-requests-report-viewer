# Copilot Instructions

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## Project Overview
This is a Next.js TypeScript application for analyzing CSV data containing user request analytics and quota information.

## Key Technologies
- Next.js 15 with App Router
- TypeScript
- Tailwind CSS
- Recharts for data visualization
- PapaParse for CSV parsing

## Code Style Guidelines
- Use functional components with React hooks
- Prefer TypeScript interfaces over types for object shapes
- Use Tailwind CSS for all styling
- Follow Next.js App Router conventions
- Use meaningful component and variable names
- Include proper error handling for file operations
- Ensure components are accessible and responsive

## Data Structure
The CSV data follows this format:
```
Timestamp,User,Model,Requests Used,Exceeds Monthly Quota,Total Monthly Quota
2025-06-03T11:05:27Z,USerA,gpt-4.1-2025-04-14,1.00,false,Unlimited
```

## Component Architecture
- Keep components small and focused on single responsibilities
- Use proper TypeScript typing for all props and state
- Implement proper loading states and error handling
- Use React best practices for performance optimization
