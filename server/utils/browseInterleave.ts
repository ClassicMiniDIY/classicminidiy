/**
 * Plan one page of an interleaved browse list that LEADS with first-party models
 * but keeps external ("Around the Web") listings visible on every page — so
 * first-party are prioritized without ever burying external off the end.
 *
 * The merged sequence repeats a group of [first-party × FP_PER_GROUP, external ×
 * EXT_PER_GROUP] (2:1 by default), each kind consumed in its own sorted rank
 * order. When one kind runs out, the remainder of the other fills the rest, so
 * pages stay full and nothing is hidden. Pagination is stateless: given the two
 * kind totals + offset/limit, it returns the rank ranges to fetch per kind and
 * the exact placement order for the page.
 */
export const FP_PER_GROUP = 2;
export const EXT_PER_GROUP = 1;

export type BrowseKind = 'first_party' | 'external';

export interface InterleavePlan {
  /** Placement order for the page — one entry per slot, length ≤ limit. */
  order: BrowseKind[];
  /** 0-based rank offset + count to fetch from each kind for this page. */
  fpStart: number;
  fpCount: number;
  extStart: number;
  extCount: number;
}

export function planInterleave(
  fpTotal: number,
  extTotal: number,
  offset: number,
  limit: number,
  fpPerGroup = FP_PER_GROUP,
  extPerGroup = EXT_PER_GROUP
): InterleavePlan {
  const order: BrowseKind[] = [];
  let fpUsed = 0;
  let extUsed = 0;
  let pos = 0;
  let fpStart = -1;
  let fpCount = 0;
  let extStart = -1;
  let extCount = 0;
  const end = offset + Math.max(0, limit);

  const emit = (kind: BrowseKind) => {
    if (pos >= offset && pos < end) {
      order.push(kind);
      if (kind === 'first_party') {
        if (fpStart < 0) fpStart = fpUsed;
        fpCount++;
      } else {
        if (extStart < 0) extStart = extUsed;
        extCount++;
      }
    }
    if (kind === 'first_party') fpUsed++;
    else extUsed++;
    pos++;
  };

  while (pos < end && (fpUsed < fpTotal || extUsed < extTotal)) {
    let progressed = false;
    for (let k = 0; k < fpPerGroup && fpUsed < fpTotal && pos < end; k++) {
      emit('first_party');
      progressed = true;
    }
    for (let k = 0; k < extPerGroup && extUsed < extTotal && pos < end; k++) {
      emit('external');
      progressed = true;
    }
    if (!progressed) break; // page window starts past all rows
  }

  return {
    order,
    fpStart: fpStart < 0 ? 0 : fpStart,
    fpCount,
    extStart: extStart < 0 ? 0 : extStart,
    extCount,
  };
}
