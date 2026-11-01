/** Bound the id so RR-LD-1 does not match a note written for RR-LD-10. */
export function assistancePaymentNotesMatchLead(notes: string, leadId: string): boolean {
  return notes.includes(` lead=${leadId} package=`);
}
