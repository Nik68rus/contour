import type {
  PointerEvent as ReactPointerEvent,
  PointerEventHandler,
} from "react";
import type { Contour } from "./types";

type MaskStageProps = {
  imageUrl: string;
  imageName: string;
  imageSize: { width: number; height: number };
  showImage: boolean;
  stageWidth: number;
  stageHeight: number;
  stageScale: number;
  contours: Contour[];
  selectedId: number | null;
  fillOpacity: number;
  strokeWidth: number;
  onImageLoad: (size: { width: number; height: number }) => void;
  onCanvasPointerDown: PointerEventHandler<SVGSVGElement>;
  onCanvasPointerMove: PointerEventHandler<SVGSVGElement>;
  onCanvasPointerEnd: () => void;
  onSelectContour: (id: number) => void;
  onPointPointerDown: (
    event: ReactPointerEvent<SVGCircleElement>,
    contour: Contour,
    pointIndex: number,
  ) => void;
};

export function MaskStage({
  imageUrl,
  imageName,
  imageSize,
  showImage,
  stageWidth,
  stageHeight,
  stageScale,
  contours,
  selectedId,
  fillOpacity,
  strokeWidth,
  onImageLoad,
  onCanvasPointerDown,
  onCanvasPointerMove,
  onCanvasPointerEnd,
  onSelectContour,
  onPointPointerDown,
}: MaskStageProps) {
  return (
    <div
      className="stage-space"
      style={{
        width: stageWidth + 96,
        height: stageHeight + 96,
      }}
    >
      <div
        className="image-stage"
        style={{ width: stageWidth, height: stageHeight }}
      >
        {showImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={imageName}
            draggable={false}
            onLoad={(event) =>
              onImageLoad({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              })
            }
          />
        )}
        {!showImage && !imageSize.width && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            className="dimension-probe"
            onLoad={(event) =>
              onImageLoad({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              })
            }
          />
        )}
        {imageSize.width > 0 && (
          <svg
            className="mask-layer"
            viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}
            preserveAspectRatio="none"
            onPointerDown={onCanvasPointerDown}
            onPointerMove={onCanvasPointerMove}
            onPointerUp={onCanvasPointerEnd}
            onPointerCancel={onCanvasPointerEnd}
            onPointerLeave={onCanvasPointerEnd}
            aria-label="Область создания SVG маски"
          >
            {contours
              .filter((contour) => contour.visible)
              .map((contour) => {
                const pointString = contour.points
                  .map((point) => `${point.x},${point.y}`)
                  .join(" ");
                return (
                  <g key={contour.id}>
                    {contour.closed ? (
                      <polygon
                        points={pointString}
                        fill={contour.color}
                        fillOpacity={fillOpacity / 100}
                        stroke={contour.color}
                        strokeWidth={strokeWidth / stageScale}
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          onSelectContour(contour.id);
                        }}
                      />
                    ) : (
                      <polyline
                        points={pointString}
                        fill="none"
                        stroke={contour.color}
                        strokeWidth={strokeWidth / stageScale}
                      />
                    )}
                    {selectedId === contour.id &&
                      contour.points.map((point, pointIndex) => (
                        <circle
                          key={`${contour.id}-${pointIndex}`}
                          cx={point.x}
                          cy={point.y}
                          r={(pointIndex === 0 ? 6 : 4.5) / stageScale}
                          fill={
                            !contour.closed && pointIndex === 0
                              ? contour.color
                              : "#ffffff"
                          }
                          stroke={contour.color}
                          strokeWidth={2 / stageScale}
                          className={
                            !contour.closed &&
                            pointIndex === 0 &&
                            contour.points.length >= 3
                              ? "closing-point"
                              : ""
                          }
                          onPointerDown={(event) =>
                            onPointPointerDown(event, contour, pointIndex)
                          }
                        />
                      ))}
                  </g>
                );
              })}
          </svg>
        )}
      </div>
    </div>
  );
}
