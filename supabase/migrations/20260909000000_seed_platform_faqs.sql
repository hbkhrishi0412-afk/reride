-- Ensure faqs exists (idempotent), then seed defaults only when empty.
CREATE TABLE IF NOT EXISTS public.faqs (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.faqs (id, question, answer, category, "createdAt", "updatedAt")
SELECT v.id, v.question, v.answer, v.category, NOW(), NOW()
FROM (VALUES
  ('1', 'What is a ReRide deal room?', 'When you start a tracked deal on a listing, ReRide opens a deal room for that vehicle. You can chat with the seller, send offers, upload documents, and follow milestones from interest through RC transfer — all in one place.', 'Deals & RC'),
  ('2', 'How do I track RC transfer?', 'Inside your deal room, the timeline shows stages such as offer, token, delivery, and RC transfer. Upload or confirm documents at each step. Both buyer and seller can see progress in their dashboards under My Deals.', 'Deals & RC'),
  ('3', 'What documents should I collect when buying?', 'Typically: original RC, valid insurance, PUC, sale agreement, Form 29/30, NOC if applicable, and loan closure letter if financed. Verify engine and chassis numbers against the RC and Parivahan before paying.', 'Deals & RC'),
  ('4', 'Is it safe to buy on ReRide?', 'ReRide provides tools and policies to reduce risk — RC details on listings, deal tracking, and safety guidance. We do not guarantee vehicle condition. You must inspect the vehicle, verify RC independently, and never pay the full amount before inspection.', 'Buying'),
  ('5', 'What payment methods does ReRide accept for vehicles?', 'Vehicle payments are arranged directly between buyer and seller. ReRide does not hold or process vehicle sale money. Seller subscriptions and optional deal assistance packages are paid via Razorpay.', 'Buying'),
  ('6', 'Are all sellers verified?', 'Phone verification and document uploads are shown on profiles and listings where completed. Not every seller completes every step. Always verify RC, inspect the vehicle, and use the deal checklist.', 'Buying'),
  ('7', 'Does ReRide buy my car or pay instantly?', 'No. ReRide is a listing and deal-tracking platform. You set your price, respond to buyers, and complete the sale directly. We do not offer instant buyout, doorstep pickup, or same-day payout.', 'Selling'),
  ('8', 'Is listing free?', 'Individual sellers can list vehicles free. Optional paid plans add featured placement and more listings. See Pricing for dealer plans.', 'Selling'),
  ('9', 'How do I sign in to track my deal?', 'Create a buyer account or sign in at Login. After you start a deal on a vehicle, open Buyer Dashboard → My Deals to see all active deals and next actions.', 'Account'),
  ('10', 'Can I get a refund on my seller plan?', 'Seller subscriptions are non-refundable for the current billing period. You can cancel anytime — your plan will not renew next cycle. See our Refund Policy for deal assistance packages.', 'Subscriptions'),
  ('11', 'How do I report a suspicious listing?', 'Use Report on the listing or contact Support. We review reports and may remove listings or suspend accounts. For payment fraud, also contact your bank and local cybercrime authorities.', 'Safety'),
  ('12', 'Should I pay outside ReRide chat?', 'Avoid moving off-platform before you have verified the vehicle and seller. Scammers often pressure buyers to pay via unusual apps or full advance. Use the deal room and meet safely in person before large payments.', 'Safety')
) AS v(id, question, answer, category)
WHERE NOT EXISTS (SELECT 1 FROM public.faqs LIMIT 1);
