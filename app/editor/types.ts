export type Point = { x: number; y: number };

export type Contour = {
  id: number;
  name: string;
  color: string;
  points: Point[];
  closed: boolean;
  visible: boolean;
};

export type ProjectState = {
  version: 1;
  imageName: string;
  imageSize: { width: number; height: number };
  contours: Contour[];
  selectedId: number | null;
  nextId: number;
  zoom: number;
  fillOpacity: number;
  strokeWidth: number;
  showImage: boolean;
  showGrid: boolean;
};

export type ProjectBackup = {
  product: "contour";
  formatVersion: 1;
  state: ProjectState;
  image: {
    name: string;
    type: string;
    dataUrl: string;
  };
};

export type ProjectSummary = {
  id: string;
  title: string;
  imageName: string;
  imageType: string;
  contourCount: number;
  createdAt: string;
  updatedAt: string;
};

export type SaveStatus = "restoring" | "idle" | "saving" | "saved" | "error";

export const MASK_COLORS = [
  "#FF6B35",
  "#5B5BD6",
  "#11A36A",
  "#E1467C",
  "#E7A400",
];

export const ZOOM_STEPS = [25, 50, 75, 100, 125, 150, 200];
