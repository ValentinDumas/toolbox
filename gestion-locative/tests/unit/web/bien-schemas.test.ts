import { describe, it, expect } from 'vitest';
import { lotCreationSchema } from '../../../src/web/schemas/bien-schemas.js';

describe('lotCreationSchema — superRefine surface', () => {
  it('rejette type=appartement + surface=null avec issue.path=[surface] et message contenant obligatoire', () => {
    const result = lotCreationSchema.safeParse({
      designation: 'Appartement principal',
      type: 'appartement',
      surface: null,
      etage: null,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const surfaceIssue = result.error.issues.find((i) => i.path.includes('surface'));
      expect(surfaceIssue, 'Doit avoir une issue sur le path surface').toBeTruthy();
      expect(surfaceIssue?.message).toMatch(/obligatoire/i);
    }
  });

  it('rejette type=local_commercial + surface=0 avec issue.path=[surface]', () => {
    const result = lotCreationSchema.safeParse({
      designation: 'Local commercial',
      type: 'local_commercial',
      surface: 0,
      etage: null,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const surfaceIssue = result.error.issues.find((i) => i.path.includes('surface'));
      expect(surfaceIssue, 'Doit avoir une issue sur le path surface').toBeTruthy();
    }
  });

  it("accepte type=parking + surface=null (parking n'exige pas de surface)", () => {
    const result = lotCreationSchema.safeParse({
      designation: 'Parking 1',
      type: 'parking',
      surface: null,
      etage: null,
    });

    expect(result.success).toBe(true);
  });

  it('accepte type=appartement + surface=45 (cas nominal)', () => {
    const result = lotCreationSchema.safeParse({
      designation: 'Appartement principal',
      type: 'appartement',
      surface: 45,
      etage: null,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.surface).toBe(45);
    }
  });
});
