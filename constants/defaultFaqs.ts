import type { FAQItem } from '../types.js';

/** Truthful default FAQs when Supabase has none — aligned with intermediary deal-tracking model. */
export const DEFAULT_PLATFORM_FAQS: FAQItem[] = [
  {
    id: 1,
    category: 'Deals & RC',
    question: 'What is a ReRide deal room?',
    answer:
      'When you start a tracked deal on a listing, ReRide opens a deal room for that vehicle. You can chat with the seller, send offers, upload documents, and follow milestones from interest through RC transfer — all in one place.',
  },
  {
    id: 2,
    category: 'Deals & RC',
    question: 'How do I track RC transfer?',
    answer:
      'Inside your deal room, the timeline shows stages such as offer, token, delivery, and RC transfer. Upload or confirm documents at each step. Both buyer and seller can see progress in their dashboards under My Deals.',
  },
  {
    id: 3,
    category: 'Deals & RC',
    question: 'What documents should I collect when buying?',
    answer:
      'Typically: original RC, valid insurance, PUC, sale agreement, Form 29/30, NOC if applicable, and loan closure letter if financed. Verify engine and chassis numbers against the RC and Parivahan before paying.',
  },
  {
    id: 4,
    category: 'Buying',
    question: 'Is it safe to buy on ReRide?',
    answer:
      'ReRide provides tools and policies to reduce risk — RC details on listings, deal tracking, and safety guidance. We do not guarantee vehicle condition. You must inspect the vehicle, verify RC independently, and never pay the full amount before inspection.',
  },
  {
    id: 5,
    category: 'Buying',
    question: 'What payment methods does ReRide accept for vehicles?',
    answer:
      'Vehicle payments are arranged directly between buyer and seller. ReRide does not hold or process vehicle sale money. Seller subscriptions and optional deal assistance packages are paid via Razorpay.',
  },
  {
    id: 6,
    category: 'Buying',
    question: 'Are all sellers verified?',
    answer:
      'Phone verification and document uploads are shown on profiles and listings where completed. Not every seller completes every step. Always verify RC, inspect the vehicle, and use the deal checklist.',
  },
  {
    id: 7,
    category: 'Selling',
    question: 'Does ReRide buy my car or pay instantly?',
    answer:
      'No. ReRide is a listing and deal-tracking platform. You set your price, respond to buyers, and complete the sale directly. We do not offer instant buyout, doorstep pickup, or same-day payout.',
  },
  {
    id: 8,
    category: 'Selling',
    question: 'Is listing free?',
    answer:
      'Individual sellers can list vehicles free. Optional paid plans add featured placement and more listings. See Pricing for dealer plans.',
  },
  {
    id: 9,
    category: 'Account',
    question: 'How do I sign in to track my deal?',
    answer:
      'Create a buyer account or sign in at Login. After you start a deal on a vehicle, open Buyer Dashboard → My Deals to see all active deals and next actions.',
  },
  {
    id: 10,
    category: 'Subscriptions',
    question: 'Can I get a refund on my seller plan?',
    answer:
      'Seller subscriptions are non-refundable for the current billing period. You can cancel anytime — your plan will not renew next cycle. See our Refund Policy for deal assistance packages.',
  },
  {
    id: 11,
    category: 'Safety',
    question: 'How do I report a suspicious listing?',
    answer:
      'Use Report on the listing or contact Support. We review reports and may remove listings or suspend accounts. For payment fraud, also contact your bank and local cybercrime authorities.',
  },
  {
    id: 12,
    category: 'Safety',
    question: 'Should I pay outside ReRide chat?',
    answer:
      'Avoid moving off-platform before you have verified the vehicle and seller. Scammers often pressure buyers to pay via unusual apps or full advance. Use the deal room and meet safely in person before large payments.',
  },
];
