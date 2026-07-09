/**
 * Force white backgrounds and dark readable text on dashboard UIs in dark mode.
 */
import fs from 'fs';
import path from 'path';

const root = process.cwd();

const files = [
  'components/AdminPanel.tsx',
  'components/DashboardOptimized.tsx',
  'components/CarServiceDashboard.tsx',
  'components/dashboard/shared.tsx',
  'components/command-center/SellerCommandHome.tsx',
  'components/command-center/SellerDealCalendar.tsx',
  'components/command-center/DealDetailPage.tsx',
  'components/command-center/DealComplaintModal.tsx',
  'components/command-center/MechanicBookingModal.tsx',
  'components/admin/AdminListingColumns.tsx',
];

const rules = [
  [/dark:bg-gray-900\/\d+/g, 'dark:bg-white'],
  [/dark:bg-slate-900\/\d+/g, 'dark:bg-white'],
  [/dark:bg-slate-800\/\d+/g, 'dark:bg-gray-50'],
  [/dark:bg-gray-900/g, 'dark:bg-white'],
  [/dark:bg-gray-800/g, 'dark:bg-white'],
  [/dark:bg-gray-700/g, 'dark:bg-gray-50'],
  [/dark:bg-slate-900/g, 'dark:bg-white'],
  [/dark:bg-slate-950/g, 'dark:bg-white'],
  [/dark:bg-slate-800/g, 'dark:bg-gray-50'],
  [/dark:from-violet-950\/\d+/g, 'dark:from-violet-50/80'],
  [/dark:to-slate-900\/\d+/g, 'dark:to-white'],
  [/dark:from-indigo-950\/\d+/g, 'dark:from-indigo-50/80'],
  [/dark:via-slate-900\/\d+/g, ''],
  [/dark:to-blue-950\/\d+/g, 'dark:to-blue-50/40'],
  [/ dark:text-white/g, ''],
  [/ dark:text-gray-100/g, ''],
  [/ dark:text-gray-200/g, ''],
  [/ dark:text-gray-300/g, ''],
  [/ dark:text-gray-400/g, ''],
  [/ dark:text-slate-200/g, ''],
  [/ dark:text-slate-300/g, ''],
  [/dark:border-gray-700/g, 'dark:border-gray-200'],
  [/dark:border-gray-600/g, 'dark:border-gray-200'],
  [/dark:border-slate-700/g, 'dark:border-gray-200'],
  [/dark:border-slate-800/g, 'dark:border-gray-200'],
  [/dark:border-violet-600/g, 'dark:border-violet-300'],
  [/dark:divide-slate-800/g, 'dark:divide-gray-100'],
  [/dark:hover:bg-gray-800/g, 'dark:hover:bg-gray-50'],
  [/dark:hover:bg-gray-700/g, 'dark:hover:bg-gray-50'],
  [/dark:hover:bg-slate-800\/\d+/g, 'dark:hover:bg-gray-50'],
  [/dark:hover:text-white/g, ''],
  [/bg-slate-900 text-white dark:bg-white dark:text-slate-900/g, 'bg-slate-900 text-white'],
];

for (const rel of files) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    console.warn('Skip missing', rel);
    continue;
  }
  let content = fs.readFileSync(file, 'utf8');
  const original = content;
  for (const [pattern, replacement] of rules) {
    content = content.replace(pattern, replacement);
  }
  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log('Updated', rel);
  } else {
    console.log('No changes', rel);
  }
}
