// Re-export main handler to make /api/vehicle-data work (consolidated into main.ts)
export { default } from './main';

// NOTE: This file was previously a standalone handler but is now consolidated into main.ts
// to reduce the number of serverless functions. The functionality is preserved in main.ts.
