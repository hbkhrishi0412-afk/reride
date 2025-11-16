// Re-export business handler to make /api/plans work (consolidated into business.ts)
// Plans are handled via /api/business?type=plans or /api/plans redirects to business.ts
export { default } from './business';
