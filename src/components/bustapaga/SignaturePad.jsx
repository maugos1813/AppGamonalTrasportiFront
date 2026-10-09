import { useEffect, useImperativeHandle, useRef } from "react";

const WIDTH = 560;
const HEIGHT = 200;

// Recuadro para firmar con el dedo (o el mouse). El padre pide la firma con ref.current.toDataURL() y la
// limpia con ref.current.clear(); onInkChange avisa si ya hay algo dibujado.
export const SignaturePad = ({ ref, onInkChange }) => {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);

  const paintBackground = () => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(24, HEIGHT - 44);
    ctx.lineTo(WIDTH - 24, HEIGHT - 44);
    ctx.stroke();
  };

  useEffect(() => {
    paintBackground();
  }, []);

  useImperativeHandle(ref, () => ({
    clear: () => {
      paintBackground();
      hasInk.current = false;
      onInkChange?.(false);
    },
    toDataURL: () => canvasRef.current.toDataURL("image/png"),
    hasInk: () => hasInk.current,
  }));

  const point = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
    };
  };

  const start = (event) => {
    event.preventDefault();
    canvasRef.current.setPointerCapture(event.pointerId);
    drawing.current = true;
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = point(event);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
    // Un toque sin movimiento deja un punto.
    ctx.lineTo(x + 0.01, y + 0.01);
    ctx.stroke();
  };

  const move = (event) => {
    if (!drawing.current) return;
    event.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = point(event);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasInk.current) {
      hasInk.current = true;
      onInkChange?.(true);
    }
  };

  const end = () => {
    drawing.current = false;
  };

  return (
    <canvas
      ref={canvasRef}
      width={WIDTH}
      height={HEIGHT}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onPointerLeave={end}
      aria-label="Recuadro para firmar"
      className="h-[160px] w-full touch-none rounded-xl border border-line/20 bg-white sm:h-[200px]"
    />
  );
};
