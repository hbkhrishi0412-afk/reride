import { VehicleCategory } from '../../vehicle-category.js';
import type { ChecklistFilledByRole, PhotoRequirement, UniversalChecklistItemDef } from './types.js';

type ItemInput = {
  id: string;
  sectionId: string;
  sectionTitle: string;
  label: string;
  filledBy: ChecklistFilledByRole;
  photoRequired: PhotoRequirement;
  scope: UniversalChecklistItemDef['scope'];
  buyerHint?: string;
};

function item(input: ItemInput): UniversalChecklistItemDef {
  return input;
}

/** Core checklist — applies to every vehicle category */
export const CORE_CHECKLIST_ITEMS: UniversalChecklistItemDef[] = [
  // 1.1 Documents & Legal
  item({ id: 'core.docs.rc_photo', sectionId: 'core.docs', sectionTitle: '1.1 Documents & Legal', label: 'Registration Certificate (RC) photo, both sides', filledBy: 'S', photoRequired: true, scope: 'core' }),
  item({ id: 'core.docs.rc_vahan_match', sectionId: 'core.docs', sectionTitle: '1.1 Documents & Legal', label: 'RC details match VAHAN database (number, owner name, class)', filledBy: 'S/B', photoRequired: false, scope: 'core', buyerHint: 'Cross-check RC with VAHAN tab on listing' }),
  item({ id: 'core.docs.hypothecation', sectionId: 'core.docs', sectionTitle: '1.1 Documents & Legal', label: 'Hypothecation / loan status on RC (any active lien?)', filledBy: 'S/B', photoRequired: false, scope: 'core' }),
  item({ id: 'core.docs.owner_count', sectionId: 'core.docs', sectionTitle: '1.1 Documents & Legal', label: 'Number of previous owners', filledBy: 'S', photoRequired: false, scope: 'core' }),
  item({ id: 'core.docs.insurance_cert', sectionId: 'core.docs', sectionTitle: '1.1 Documents & Legal', label: 'Insurance certificate, valid and current', filledBy: 'S', photoRequired: true, scope: 'core' }),
  item({ id: 'core.docs.insurance_type', sectionId: 'core.docs', sectionTitle: '1.1 Documents & Legal', label: 'Insurance type (comprehensive / third-party only)', filledBy: 'S', photoRequired: false, scope: 'core' }),
  item({ id: 'core.docs.puc', sectionId: 'core.docs', sectionTitle: '1.1 Documents & Legal', label: 'Pollution Under Control (PUC) certificate, valid', filledBy: 'S', photoRequired: true, scope: 'core' }),
  item({ id: 'core.docs.road_tax', sectionId: 'core.docs', sectionTitle: '1.1 Documents & Legal', label: 'Road tax payment status (one-time / current)', filledBy: 'S', photoRequired: false, scope: 'core' }),
  item({ id: 'core.docs.challans', sectionId: 'core.docs', sectionTitle: '1.1 Documents & Legal', label: 'Pending traffic challans (e-challan check)', filledBy: 'S/B', photoRequired: false, scope: 'core' }),
  item({ id: 'core.docs.fitness_cert', sectionId: 'core.docs', sectionTitle: '1.1 Documents & Legal', label: 'Fitness certificate (mandatory for commercial categories)', filledBy: 'S', photoRequired: true, scope: 'core' }),

  // 1.2 General Condition & History
  item({ id: 'core.history.odometer_photo', sectionId: 'core.history', sectionTitle: '1.2 General Condition & History', label: 'Odometer / hour-meter reading (photo of display)', filledBy: 'S', photoRequired: true, scope: 'core' }),
  item({ id: 'core.history.odometer_service_match', sectionId: 'core.history', sectionTitle: '1.2 General Condition & History', label: 'Odometer reading consistent with service record history', filledBy: 'B', photoRequired: false, scope: 'core', buyerHint: 'Compare odometer photo with service stamps' }),
  item({ id: 'core.history.year_match', sectionId: 'core.history', sectionTitle: '1.2 General Condition & History', label: 'Year of manufacture vs. year of registration match', filledBy: 'S/B', photoRequired: false, scope: 'core' }),
  item({ id: 'core.history.chassis_match', sectionId: 'core.history', sectionTitle: '1.2 General Condition & History', label: 'Chassis number visible and matches RC', filledBy: 'S', photoRequired: true, scope: 'core' }),
  item({ id: 'core.history.engine_match', sectionId: 'core.history', sectionTitle: '1.2 General Condition & History', label: 'Engine number visible and matches RC', filledBy: 'S', photoRequired: true, scope: 'core' }),
  item({ id: 'core.history.last_service', sectionId: 'core.history', sectionTitle: '1.2 General Condition & History', label: 'Last service date and odometer/hour-meter at that service', filledBy: 'S', photoRequired: true, scope: 'core', buyerHint: 'Ask for service record photo' }),
  item({ id: 'core.history.service_records', sectionId: 'core.history', sectionTitle: '1.2 General Condition & History', label: 'Service history book / digital service records available', filledBy: 'S', photoRequired: true, scope: 'core' }),
  item({ id: 'core.history.accident', sectionId: 'core.history', sectionTitle: '1.2 General Condition & History', label: 'Accident history disclosed (if any), with repair details', filledBy: 'S', photoRequired: 'if_applicable', scope: 'core' }),
  item({ id: 'core.history.flood_fire', sectionId: 'core.history', sectionTitle: '1.2 General Condition & History', label: 'Flood / fire damage history disclosed (if any)', filledBy: 'S', photoRequired: false, scope: 'core' }),
  item({ id: 'core.history.reason_sale', sectionId: 'core.history', sectionTitle: '1.2 General Condition & History', label: 'Reason for sale stated', filledBy: 'S', photoRequired: false, scope: 'core' }),

  // 1.3 Mandatory Photo Set
  item({ id: 'core.photos.front', sectionId: 'core.photos', sectionTitle: '1.3 Mandatory Photo Set', label: 'Front view (full vehicle, straight-on)', filledBy: 'S', photoRequired: true, scope: 'core' }),
  item({ id: 'core.photos.rear', sectionId: 'core.photos', sectionTitle: '1.3 Mandatory Photo Set', label: 'Rear view (full vehicle, straight-on)', filledBy: 'S', photoRequired: true, scope: 'core' }),
  item({ id: 'core.photos.left', sectionId: 'core.photos', sectionTitle: '1.3 Mandatory Photo Set', label: 'Left side view (full vehicle)', filledBy: 'S', photoRequired: true, scope: 'core' }),
  item({ id: 'core.photos.right', sectionId: 'core.photos', sectionTitle: '1.3 Mandatory Photo Set', label: 'Right side view (full vehicle)', filledBy: 'S', photoRequired: true, scope: 'core' }),
  item({ id: 'core.photos.dashboard', sectionId: 'core.photos', sectionTitle: '1.3 Mandatory Photo Set', label: 'Dashboard / instrument cluster (engine off and on)', filledBy: 'S', photoRequired: true, scope: 'core' }),
  item({ id: 'core.photos.odometer_close', sectionId: 'core.photos', sectionTitle: '1.3 Mandatory Photo Set', label: 'Odometer / hour-meter close-up', filledBy: 'S', photoRequired: true, scope: 'core' }),
  item({ id: 'core.photos.engine_bay', sectionId: 'core.photos', sectionTitle: '1.3 Mandatory Photo Set', label: 'Engine bay, clean and unobstructed view', filledBy: 'S', photoRequired: true, scope: 'core' }),
  item({ id: 'core.photos.tyres', sectionId: 'core.photos', sectionTitle: '1.3 Mandatory Photo Set', label: 'All tyres (or applicable count) close-up', filledBy: 'S', photoRequired: true, scope: 'core' }),
  item({ id: 'core.photos.damage', sectionId: 'core.photos', sectionTitle: '1.3 Mandatory Photo Set', label: 'Any existing damage, dents, or rust (close-up)', filledBy: 'S', photoRequired: 'if_applicable', scope: 'core' }),
  item({ id: 'core.photos.documents', sectionId: 'core.photos', sectionTitle: '1.3 Mandatory Photo Set', label: 'RC, Insurance, PUC documents (clear, legible)', filledBy: 'S', photoRequired: true, scope: 'core' }),
];

function categoryItems(
  scope: VehicleCategory,
  sectionPrefix: string,
  sectionTitle: string,
  rows: [id: string, label: string, filledBy: ChecklistFilledByRole, photo: PhotoRequirement, hint?: string][],
): UniversalChecklistItemDef[] {
  return rows.map(([id, label, filledBy, photoRequired, buyerHint]) =>
    item({
      id: `${sectionPrefix}.${id}`,
      sectionId: sectionPrefix,
      sectionTitle,
      label,
      filledBy,
      photoRequired,
      scope,
      buyerHint,
    }),
  );
}

export const TWO_WHEELER_ITEMS: UniversalChecklistItemDef[] = [
  ...categoryItems(VehicleCategory.TWO_WHEELER, 'tw.engine', '2.1 Engine & Drivetrain', [
    ['start', 'Engine starts smoothly without delay', 'B', false],
    ['noise', 'Unusual engine noise, knocking, or vibration', 'B', false],
    ['smoke', 'Smoke from exhaust (color: white/blue/black)', 'B', false],
    ['clutch', 'Clutch engagement smooth (manual models)', 'B', false],
    ['gears', 'Gear shifting smooth, no false neutrals', 'B', false],
    ['cvt', 'CVT / automatic transmission smooth (scooters)', 'B', false],
    ['idle', 'Idle RPM stable, no stalling', 'B', false],
    ['oil', 'Engine oil level and condition (color, not milky)', 'S/B', false],
    ['coolant', 'Coolant level and condition (liquid-cooled models)', 'S/B', false],
    ['chain', 'Chain/belt tension and lubrication (chain-drive models)', 'B', false],
  ]),
  ...categoryItems(VehicleCategory.TWO_WHEELER, 'tw.brakes', '2.2 Brakes, Suspension & Tyres', [
    ['front_brake', 'Front brake responsiveness and lever feel', 'B', false],
    ['rear_brake', 'Rear brake responsiveness and pedal feel', 'B', false],
    ['brake_wear', 'Brake disc/drum wear visible inspection', 'B', false],
    ['fork', 'Front suspension (fork) — no leaks, smooth travel', 'B', false],
    ['rear_shock', 'Rear suspension (shock absorber) — no leaks, sag check', 'B', false],
    ['tyre_tread', 'Tyre tread depth (legal minimum, even wear)', 'S/B', true],
    ['tyre_age', 'Tyre brand/age (DOT/manufacture date on sidewall)', 'B', false],
    ['wheels', 'Wheel alignment / rim damage check', 'B', false],
    ['battery', 'Battery condition and self-start function', 'B', false],
    ['lights', 'Horn, headlamp, tail lamp, indicators all functional', 'B', false],
  ]),
  ...categoryItems(VehicleCategory.TWO_WHEELER, 'tw.body', '2.3 Electricals, Body & Final Checks', [
    ['console', 'Speedometer/console electronics functional', 'B', false],
    ['fuel_gauge', 'Fuel gauge / fuel cap lock functional', 'B', false],
    ['seat', 'Seat condition (tears, foam compression)', 'S/B', true],
    ['paint', 'Paint condition / fading / mismatched panels (repaint signs)', 'B', false],
    ['frame', 'Frame/chassis visible cracks or weld repair marks', 'B', false],
    ['stand', 'Side stand / center stand spring and function', 'B', false],
    ['mirrors', 'Mirrors present, unbroken, properly mounted', 'S/B', false],
    ['test_ride', 'Test ride conducted (straight line + braking + turning)', 'B', false],
    ['duplicate_key', 'Duplicate key available', 'S', false],
  ]),
];

export const FOUR_WHEELER_ITEMS: UniversalChecklistItemDef[] = [
  ...categoryItems(VehicleCategory.FOUR_WHEELER, 'fw.engine', '3.1 Engine & Transmission', [
    ['start', 'Engine starts smoothly, no delay or cranking issue', 'B', false],
    ['noise', 'Engine noise — knocking, ticking, or rattling', 'B', false],
    ['smoke', 'Exhaust smoke color (white/blue = concern)', 'B', false],
    ['oil', 'Engine oil level, color, and smell (no burning smell)', 'S/B', false],
    ['coolant', 'Coolant level and condition, no oil-coolant mixing', 'S/B', false],
    ['manual_gear', 'Transmission — gear shifts smooth (manual)', 'B', false],
    ['auto_gear', 'Transmission — no jerks/delay in shifting (automatic)', 'B', false],
    ['clutch', 'Clutch biting point normal, no slipping', 'B', false],
    ['turbo', 'Turbocharger function, if equipped (lag/whine check)', 'B', false],
    ['mounts', 'Engine mounts — no excessive vibration at idle', 'B', false],
  ]),
  ...categoryItems(VehicleCategory.FOUR_WHEELER, 'fw.brakes', '3.2 Brakes, Suspension, Steering & Tyres', [
    ['pedal', 'Brake pedal feel — firm, no sponginess', 'B', false],
    ['abs', 'ABS warning light behavior at start-up', 'B', false],
    ['pad_wear', 'Brake pad/disc wear (visible inspection)', 'B', false],
    ['handbrake', 'Handbrake / electronic parking brake function', 'B', false],
    ['suspension', 'Suspension — no clunks over bumps, even ride height', 'B', false],
    ['steering', 'Steering — no excessive play, no pulling to one side', 'B', false],
    ['alignment', 'Wheel alignment — uneven tyre wear check', 'B', false],
    ['tyres', 'Tyre tread depth across all tyres, including spare', 'S/B', true],
    ['tyre_age', 'Tyre manufacture date (DOT code) — not excessively aged', 'B', false],
    ['underbody_rust', 'Under-body rust or corrosion check', 'B', false],
  ]),
  ...categoryItems(VehicleCategory.FOUR_WHEELER, 'fw.interior', '3.3 Interior, Electricals & Body', [
    ['ac', 'AC cooling performance and odor check', 'B', false],
    ['windows', 'Power windows, central locking, all functional', 'B', false],
    ['infotainment', 'Infotainment, reverse camera, sensors functional', 'B', false],
    ['airbag', 'Airbag warning light — no fault indication', 'B', false],
    ['seatbelts', 'Seatbelt function and condition (all seats)', 'B', false],
    ['upholstery', 'Upholstery condition, no major tears/stains', 'S/B', true],
    ['paint', 'Paint thickness / repaint check (panel-by-panel color match)', 'B', false],
    ['panel_gaps', 'Body panel gaps even (sign of accident repair if uneven)', 'B', false],
    ['windshield', 'Windshield — chips, cracks, or wiper streaking', 'S/B', true],
    ['battery', 'Battery health and terminal corrosion', 'B', false],
  ]),
  ...categoryItems(VehicleCategory.FOUR_WHEELER, 'fw.final', '3.4 Test Drive & Final Checks', [
    ['tracking', 'Test drive — straight-line tracking, no pulling', 'B', false],
    ['braking', 'Test drive — braking performance at moderate speed', 'B', false],
    ['highway', 'Test drive — highway speed stability (if possible)', 'B', false],
    ['warnings', 'Dashboard warning lights — none persisting after start', 'B', false],
    ['obd', 'OBD scan / diagnostic check (if accessible to buyer/partner)', 'P', false],
    ['toolkit', 'Jack, spare tyre, toolkit present and usable', 'S', true],
    ['keys', 'Duplicate key and remote available', 'S', false],
    ['service_stamps', 'Service history — authorized service center stamps verified', 'S/B', true],
    ['mods', 'Any aftermarket modifications disclosed (engine, body, electronics)', 'S', 'if_applicable'],
    ['rto_transfer', 'RTO transfer feasibility confirmed (interstate sale, if applicable)', 'S/B', false],
  ]),
];

export const THREE_WHEELER_ITEMS: UniversalChecklistItemDef[] = [
  ...categoryItems(VehicleCategory.THREE_WHEELER, 'thw.addon', '4. Three-Wheeler Add-On', [
    ['permit', 'Permit validity (passenger/goods carriage permit)', 'S', true],
    ['engine_start', 'Engine starts smoothly, no excessive smoke', 'B', false],
    ['clutch_gears', 'Clutch and gear shifting smooth', 'B', false],
    ['brakes', 'Brake performance (front and rear)', 'B', false],
    ['tyres', 'Tyre condition, all three wheels including spare', 'S/B', true],
    ['chassis', 'Chassis/frame — rust, cracks, or weld repairs', 'B', false],
    ['cabin', 'Cabin/seat condition and door function', 'S/B', true],
    ['meter', 'Meter/fare box functional (if passenger 3W)', 'B', false],
    ['electrical', 'Battery and electrical (horn, lights, indicators)', 'B', false],
    ['cng', 'CNG/LPG kit certification valid, if fitted', 'S', true],
    ['load_body', 'Load body condition (if goods carrier — dents, floor integrity)', 'S/B', true],
    ['fitness', 'Fitness certificate current and valid', 'S', true],
  ]),
];

export const FARM_ITEMS: UniversalChecklistItemDef[] = [
  ...categoryItems(VehicleCategory.FARM, 'farm.addon', '5. Farm Vehicle (Tractor) Add-On', [
    ['hour_meter', 'Hour-meter reading and consistency with service records', 'S/B', true],
    ['engine_start', 'Engine starts smoothly, no excessive smoke', 'B', false],
    ['hydraulics', 'Hydraulic system function (lift arms, draft control)', 'B', false],
    ['pto', 'PTO (power take-off) shaft function and guard present', 'B', false],
    ['clutch', 'Clutch and gear shifting, including reverse', 'B', false],
    ['brakes', 'Brake performance, left/right independent braking', 'B', false],
    ['tyres', 'Tyre condition — front and rear, tread depth', 'S/B', true],
    ['steering', 'Steering — play, alignment, power steering function if equipped', 'B', false],
    ['implements', 'Implements/attachments included in sale (disclosed)', 'S', 'if_applicable'],
    ['chassis', 'Chassis and axle — cracks, rust, weld repairs', 'B', false],
    ['fluids', 'Engine oil, coolant, hydraulic fluid levels and condition', 'S/B', false],
    ['rc_insurance', 'RC and insurance valid for the registered usage class', 'S', true],
  ]),
];

export const COMMERCIAL_ITEMS: UniversalChecklistItemDef[] = [
  ...categoryItems(VehicleCategory.COMMERCIAL, 'cv.addon', '6. Commercial Vehicle Add-On', [
    ['permit', 'Permit type and validity (national/state, goods/passenger)', 'S', true],
    ['fitness', 'Fitness certificate current and valid', 'S', true],
    ['odometer', 'Odometer reading and consistency with logbook/service history', 'S/B', true],
    ['engine', 'Engine starts smoothly, smoke check under load', 'B', false],
    ['transmission', 'Transmission and clutch — smooth shifting under load', 'B', false],
    ['brakes', 'Brake system — air/hydraulic pressure build-up, response', 'B/P', false],
    ['tyres', 'Tyre condition across all axles, including spare(s)', 'S/B', true],
    ['chassis', 'Chassis frame — cracks, rust, sagging, weld repairs', 'B/P', true],
    ['load_body', 'Load body / container condition (floor, walls, doors)', 'S/B', true],
    ['suspension', 'Suspension — leaf springs/air suspension condition', 'B/P', false],
    ['electrical', 'Electrical system — lights, indicators, reverse horn', 'B', false],
    ['fluids', 'Engine oil, coolant, and fuel system condition', 'S/B', false],
    ['gps', 'GPS/fleet tracking device disclosed, if installed', 'S', false],
    ['national_permit', 'National Permit / All-India Tourist Permit validity, if applicable', 'S', true],
  ]),
];

export const CONSTRUCTION_ITEMS: UniversalChecklistItemDef[] = [
  ...categoryItems(VehicleCategory.CONSTRUCTION, 'const.addon', '7. Construction Vehicle Add-On', [
    ['hour_meter', 'Hour-meter reading and service log consistency', 'S/B', true],
    ['engine', 'Engine starts smoothly, smoke check under load', 'B', false],
    ['hydraulics', 'Hydraulic system — cylinder leaks, lift/boom function', 'B/P', true],
    ['undercarriage', 'Undercarriage condition (tracks/tyres, sprockets, rollers)', 'B/P', true],
    ['boom', 'Boom/arm/bucket — cracks, weld repairs, pin and bushing wear', 'B/P', true],
    ['cabin', 'Cabin condition — controls, switches, AC, visibility', 'S/B', true],
    ['fluids', 'Engine oil, hydraulic fluid, coolant condition', 'S/B', false],
    ['attachments', 'Attachment compatibility and included attachments disclosed', 'S', 'if_applicable'],
    ['hours_life', 'Operating hours vs. typical lifespan for make/model', 'B', false],
    ['rc', 'RC/registration applicable for the equipment category', 'S', true],
    ['safety', 'Safety features — alarms, lights, ROPS/FOPS structure intact', 'B', false],
    ['load_test', 'Load test or functional demo conducted before purchase', 'B/P', false],
  ]),
];

const CATEGORY_MAP: Record<VehicleCategory, UniversalChecklistItemDef[]> = {
  [VehicleCategory.TWO_WHEELER]: TWO_WHEELER_ITEMS,
  [VehicleCategory.FOUR_WHEELER]: FOUR_WHEELER_ITEMS,
  [VehicleCategory.THREE_WHEELER]: THREE_WHEELER_ITEMS,
  [VehicleCategory.FARM]: FARM_ITEMS,
  [VehicleCategory.COMMERCIAL]: COMMERCIAL_ITEMS,
  [VehicleCategory.CONSTRUCTION]: CONSTRUCTION_ITEMS,
};

export function getAllDefinitionsForCategory(category: VehicleCategory): UniversalChecklistItemDef[] {
  return [...CORE_CHECKLIST_ITEMS, ...(CATEGORY_MAP[category] || [])];
}

export function getSellerDefinitions(category: VehicleCategory): UniversalChecklistItemDef[] {
  return getAllDefinitionsForCategory(category).filter((d) =>
    d.filledBy === 'S' || d.filledBy === 'S/B',
  );
}

export function getBuyerDefinitions(category: VehicleCategory): UniversalChecklistItemDef[] {
  return getAllDefinitionsForCategory(category).filter((d) =>
    d.filledBy === 'B' || d.filledBy === 'S/B' || d.filledBy === 'B/P',
  );
}

export function groupBySection(
  defs: UniversalChecklistItemDef[],
): { sectionId: string; sectionTitle: string; items: UniversalChecklistItemDef[] }[] {
  const map = new Map<string, { sectionId: string; sectionTitle: string; items: UniversalChecklistItemDef[] }>();
  for (const def of defs) {
    let group = map.get(def.sectionId);
    if (!group) {
      group = { sectionId: def.sectionId, sectionTitle: def.sectionTitle, items: [] };
      map.set(def.sectionId, group);
    }
    group.items.push(def);
  }
  return Array.from(map.values());
}
