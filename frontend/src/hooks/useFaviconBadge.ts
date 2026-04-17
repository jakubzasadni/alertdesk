import { useEffect } from "react";

export function useFaviconBadge(firingCount: number) {
  useEffect(() => {
    const link =
      document.querySelector<HTMLLinkElement>("link[rel~='icon']") ??
      (() => {
        const el = document.createElement("link");
        el.rel = "icon";
        el.type = "image/png";
        document.head.appendChild(el);
        return el;
      })();

    if (firingCount === 0) {
      link.href = "/prometheus-logo.png";
      document.title = "Monitoring UI";
      return;
    }

    document.title = `(${firingCount}) Monitoring UI`;

    const img = new Image();
    img.src = "/prometheus-logo.png";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, 32, 32);

      // Red dot badge (top-right)
      const r = 8;
      const cx = 25, cy = 7;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 2 * Math.PI);
      ctx.fillStyle = "#ff4d4f";
      ctx.fill();

      // Count
      const label = firingCount > 99 ? "99+" : String(firingCount);
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${firingCount > 9 ? 7 : 9}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, cx, cy);

      link.href = canvas.toDataURL("image/png");
    };
  }, [firingCount]);
}
