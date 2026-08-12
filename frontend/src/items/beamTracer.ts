type MirrorState = { x: number; y: number; orientation: "slash" | "backslash" | "horizontal" | "vertical" };

type TraceParams = {
  sourceCell: { x: number; y: number };
  targetCell: { x: number; y: number };
  gridCols: number;
  gridRows: number;
  mirrors: MirrorState[];
  startDirection?: "up" | "right" | "down" | "left";
  maxSteps?: number;
};

export function traceBeam(params: TraceParams) {
  const { sourceCell, targetCell, gridCols, gridRows, mirrors } = params;
  const maxSteps = params.maxSteps ?? 80;

  type BeamDirection = "up" | "right" | "down" | "left";

  let cellX = sourceCell.x;
  let cellY = sourceCell.y;
  let direction: BeamDirection = params.startDirection ?? "right";

  const cells: Array<{ x: number; y: number }> = [];

  for (let steps = 0; steps < maxSteps; steps += 1) {
    cells.push({ x: cellX, y: cellY });

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
  cells.push({ x: cellX, y: cellY });
  return { cells, solved: false };
}

function reflect(direction: BeamDirection, orientation: MirrorState["orientation"]) {
  // Diagonal mirrors behave like / or \ reflections
  if (orientation === "slash") {
    switch (direction) {
      case "up": return "right" as BeamDirection;
      case "right": return "up" as BeamDirection;
      case "down": return "left" as BeamDirection;
      default: return "down" as BeamDirection;
    }
  }

  if (orientation === "backslash") {
    switch (direction) {
      case "up": return "left" as BeamDirection;
      case "left": return "up" as BeamDirection;
      case "down": return "right" as BeamDirection;
      default: return "down" as BeamDirection;
    }
  }

  // Horizontal mirror: flips vertical direction, leaves horizontal unchanged
  if (orientation === "horizontal") {
    switch (direction) {
      case "up": return "down" as BeamDirection;
      case "down": return "up" as BeamDirection;
      default: return direction;
    }
  }

  // Vertical mirror: flips horizontal direction, leaves vertical unchanged
  if (orientation === "vertical") {
    switch (direction) {
      case "left": return "right" as BeamDirection;
      case "right": return "left" as BeamDirection;
      default: return direction;
    }
  }

  return direction;
}

function directionDelta(direction: BeamDirection) {
  switch (direction) {
    case "right": return { x: 1, y: 0 };
    case "left": return { x: -1, y: 0 };
    case "up": return { x: 0, y: -1 };
    default: return { x: 0, y: 1 };
  }
}
