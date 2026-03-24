import React, { useEffect, useRef } from "react";

const MagicCursor: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const trailRef = useRef<{ x: number; y: number }[]>([]);
  const mouseRef = useRef({
    x: typeof window !== "undefined" ? window.innerWidth / 2 : 0,
    y: typeof window !== "undefined" ? window.innerHeight / 2 : 0,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    const onMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
    };

    window.addEventListener("mousemove", onMove);

    const render = () => {
      rafRef.current = requestAnimationFrame(render);
      const { x, y } = mouseRef.current;

      trailRef.current.push({ x, y });
      if (trailRef.current.length > 20) trailRef.current.shift();

      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

      if (trailRef.current.length > 2) {
        ctx.beginPath();
        ctx.moveTo(trailRef.current[0].x, trailRef.current[0].y);

        for (let i = 1; i < trailRef.current.length - 2; i++) {
          const c =
            (trailRef.current[i].x + trailRef.current[i + 1].x) / 2;
          const d =
            (trailRef.current[i].y + trailRef.current[i + 1].y) / 2;

          ctx.quadraticCurveTo(
            trailRef.current[i].x,
            trailRef.current[i].y,
            c,
            d
          );
        }

        ctx.strokeStyle = "rgba(160, 90, 255, 0.25)";
        ctx.lineWidth = 8;
        ctx.shadowBlur = 15;
        ctx.shadowColor = "rgba(160, 90, 255, 0.4)";
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    };

    render();

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 9998,
      }}
    />
  );
};

export default MagicCursor;