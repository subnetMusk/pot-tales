type MirrorState = { x: number; y: number; orientation: "right" | "left" | "neutral" | "back" };

type TraceParams = {
  sourceCell: { x: number; y: number };
  targetCell: { x: number; y: number };
  gridCols: number;
  gridRows: number;
  mirrors: MirrorState[];
  startDirection?: "up" | "right" | "down" | "left";
  maxSteps?: number;
};

export type BeamDirection = "up" | "right" | "down" | "left";

export function traceBeam(params: TraceParams) {
  const { sourceCell, targetCell, gridCols, gridRows, mirrors } = params;
  const maxSteps = params.maxSteps ?? 80;

  let cellX = sourceCell.x;
  let cellY = sourceCell.y;
  let direction: BeamDirection = params.startDirection ?? "right";

  // direction here is the direction the beam is traveling as it arrives at (x, y) — i.e. its
  // "phase" at that cell, before any reflect() for a mirror sitting there is applied. Callers
  // use this to orient a mirror sprite to match the beam actually hitting it (see directionAngle).
  const cells: Array<{ x: number; y: number; direction: BeamDirection }> = [];

  for (let steps = 0; steps < maxSteps; steps += 1) {
    cells.push({ x: cellX, y: cellY, direction });

    if (cellX === targetCell.x && cellY === targetCell.y) {
      return { cells, solved: true };
    }

    const mirror = mirrors.find(m => m.x === cellX && m.y === cellY);
    if (mirror) {
      direction = reflect(direction, mirror.orientation);
    }

    const delta = directionDelta(direction);
    cellX += delta.x;
    cellY += delta.y;

    if (cellX < 0 || cellX >= gridCols || cellY < 0 || cellY >= gridRows) {
      break;
    }
  }

  // include the final out-of-bounds cell for drawing convenience
  cells.push({ x: cellX, y: cellY, direction });
  return { cells, solved: false };
}

// Clockwise compass order (screen space, y-down): up -> right -> down -> left -> up.
const CLOCKWISE_DIRECTIONS: BeamDirection[] = ["up", "right", "down", "left"];

// Orientation is a turn relative to whichever direction the beam is currently traveling in
// when it reaches the mirror (its "phase") — not a fixed world-space reflection axis. So the
// same orientation always produces the same relative turn no matter which side the beam
// entered from: neutral passes it straight through, back sends it the way it came, right/left
// turn it a quarter-turn clockwise/counterclockwise.
const ORIENTATION_TURN_STEPS: Record<MirrorState["orientation"], number> = {
  neutral: 0,
  right: 1,
  back: 2,
  left: 3
};

function reflect(direction: BeamDirection, orientation: MirrorState["orientation"]): BeamDirection {
  const currentIndex = CLOCKWISE_DIRECTIONS.indexOf(direction);
  const steps = ORIENTATION_TURN_STEPS[orientation];
  const nextIndex = (currentIndex + steps) % CLOCKWISE_DIRECTIONS.length;
  return CLOCKWISE_DIRECTIONS[nextIndex];
}

export function directionAngle(direction: BeamDirection): number {
  return CLOCKWISE_DIRECTIONS.indexOf(direction) * 90;
}

function directionDelta(direction: BeamDirection) {
  switch (direction) {
    case "right": return { x: 1, y: 0 };
    case "left": return { x: -1, y: 0 };
    case "up": return { x: 0, y: -1 };
    default: return { x: 0, y: 1 };
  }
}
