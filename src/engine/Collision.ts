export function checkRectCollision(
  r1x: number, r1y: number, r1w: number, r1h: number,
  r2x: number, r2y: number, r2w: number, r2h: number
): boolean {
  return (
    r1x + r1w >= r2x &&
    r1x <= r2x + r2w &&
    r1y + r1h >= r2y &&
    r1y <= r2y + r2h
  );
}

export function checkCircleSquareCollision(
  cx: number, cy: number, cRadius: number,
  rx: number, ry: number, rWidth: number, rHeight: number
): boolean {
  let tempX = cx;
  let tempY = cy;

  if (cx < rx) {
    tempX = rx;
  } else if (cx > rx + rWidth) {
    tempX = rx + rWidth;
  }

  if (cy < ry) {
    tempY = ry;
  } else if (cy > ry + rHeight) {
    tempY = ry + rHeight;
  }

  const disX = cx - tempX;
  const disY = cy - tempY;
  const distance = Math.sqrt(disX * disX + disY * disY);

  return distance <= cRadius;
}
