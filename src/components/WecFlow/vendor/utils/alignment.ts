export interface AlignmentBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type AlignmentGuideOrientation = "horizontal" | "vertical";

export interface AlignmentGuide {
  orientation: AlignmentGuideOrientation;
  position: number;
}

const SNAP_THRESHOLD_PX = 6;

function edgesOf(box: AlignmentBox): { verticals: number[]; horizontals: number[] } {
  return {
    verticals: [box.x, box.x + box.width / 2, box.x + box.width],
    horizontals: [box.y, box.y + box.height / 2, box.y + box.height],
  };
}

export function computeAlignmentGuides(
  dragged: AlignmentBox,
  siblings: AlignmentBox[],
): AlignmentGuide[] {
  const draggedEdges = edgesOf(dragged);
  const guides: AlignmentGuide[] = [];

  for (const sibling of siblings) {
    if (sibling.id === dragged.id) continue;
    const siblingEdges = edgesOf(sibling);

    for (const draggedX of draggedEdges.verticals) {
      for (const siblingX of siblingEdges.verticals) {
        if (Math.abs(draggedX - siblingX) <= SNAP_THRESHOLD_PX) {
          guides.push({ orientation: "vertical", position: siblingX });
        }
      }
    }

    for (const draggedY of draggedEdges.horizontals) {
      for (const siblingY of siblingEdges.horizontals) {
        if (Math.abs(draggedY - siblingY) <= SNAP_THRESHOLD_PX) {
          guides.push({ orientation: "horizontal", position: siblingY });
        }
      }
    }
  }

  const seen = new Set<string>();
  return guides.filter((guide) => {
    const key = `${guide.orientation}:${guide.position}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
