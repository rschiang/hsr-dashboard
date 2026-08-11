import type { ConstructionPackage } from '../data/types';

export type Abbreviation = ConstructionPackage | 'CVY' | 'CVSR';

/** Expansions verified against Authority documents; see README source list. */
const ABBREVIATIONS: Record<Abbreviation, string> = {
  M2M: 'Merced to Madera extension',
  CVY: 'Central Valley Wye',
  CP1: 'Construction Package 1',
  'CP2-3': 'Construction Packages 2 and 3',
  CP4: 'Construction Package 4',
  LGA: 'Locally Generated Alternative (Fresno–Bakersfield)',
  CVSR: 'Central Valley Status Report',
};

export function Abbr({ children }: { children: Abbreviation }) {
  return <abbr title={ABBREVIATIONS[children]}>{children}</abbr>;
}
