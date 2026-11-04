import { VehicleCategory } from '../vehicle-category';
import {
  getSellerDefinitions,
  groupSellerFormSteps,
} from '../lib/universalChecklist/items';
import { isSellerItemComplete } from '../lib/universalChecklist/helpers';

const CONDITION_YES_NO_IDS = [
  'core.history.accident',
  'core.history.flood_fire',
  'core.history.odometer_original',
  'core.history.service_available',
  'core.history.electricals_ok',
  'core.history.mech_ok',
  'core.history.no_warning_lights',
  'core.history.battery_ok',
  'core.history.original_paint',
  'core.history.mods',
] as const;

describe('groupSellerFormSteps', () => {
  it('groups four-wheeler seller items into exactly 3 steps covering every id once', () => {
    const steps = groupSellerFormSteps(VehicleCategory.FOUR_WHEELER);
    expect(steps.map((s) => s.id)).toEqual(['docs', 'photos', 'condition']);

    const flatIds = steps.flatMap((s) => s.items.map((i) => i.id)).sort();
    const sellerIds = getSellerDefinitions(VehicleCategory.FOUR_WHEELER)
      .map((d) => d.id)
      .sort();
    expect(flatIds).toEqual(sellerIds);

    expect(steps.find((s) => s.id === 'docs')!.items.every((i) => i.sectionId === 'core.docs')).toBe(
      true,
    );
    const photoIds = steps.find((s) => s.id === 'photos')!.items.map((i) => i.id);
    expect(photoIds).toEqual(
      expect.arrayContaining(['core.history.chassis_match', 'core.history.engine_match']),
    );
    expect(
      steps
        .find((s) => s.id === 'condition')!
        .items.every(
          (i) =>
            i.sectionId !== 'core.docs' &&
            i.sectionId !== 'core.photos' &&
            i.id !== 'core.history.chassis_match' &&
            i.id !== 'core.history.engine_match',
        ),
    ).toBe(true);
  });

  it('puts 10 Yes/No condition questions only in Step 3', () => {
    const steps = groupSellerFormSteps(VehicleCategory.FOUR_WHEELER);
    const conditionIds = steps.find((s) => s.id === 'condition')!.items.map((i) => i.id);
    const docsIds = steps.find((s) => s.id === 'docs')!.items.map((i) => i.id);
    const photoIds = steps.find((s) => s.id === 'photos')!.items.map((i) => i.id);

    for (const id of CONDITION_YES_NO_IDS) {
      expect(conditionIds).toContain(id);
      expect(docsIds).not.toContain(id);
      expect(photoIds).not.toContain(id);
    }

    const yesNoDefs = getSellerDefinitions(VehicleCategory.FOUR_WHEELER).filter(
      (d) => d.answerType === 'yes_no',
    );
    expect(yesNoDefs).toHaveLength(10);
    expect(isSellerItemComplete(yesNoDefs[0], { id: yesNoDefs[0].id, status: 'pass' })).toBe(true);
    expect(isSellerItemComplete(yesNoDefs[0], { id: yesNoDefs[0].id, status: 'fail' })).toBe(true);
    expect(isSellerItemComplete(yesNoDefs[0], { id: yesNoDefs[0].id, status: '' })).toBe(false);
  });
});
