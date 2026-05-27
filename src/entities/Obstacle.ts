export interface Obstacle {
  x: number;
  y: number;
  radius: number;
  type: "rock" | "tombstone" | "shrub";
  color: string;
  outlineColor: string;
  size: number;
}

export interface FloorDecal {
  x: number;
  y: number;
  size: number;
  type: number;
}
