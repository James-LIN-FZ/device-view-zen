import { cn } from "@/lib/utils";
import logoUrl from "@/assets/brand-logo.png";

/**
 * UBS-Mux brand mark — uses the provided 5G+4K artwork.
 * `size` controls the rendered height; width scales by the image's aspect ratio.
 */
export function BrandLogo({
  className,
  size = 32,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <img
      src={logoUrl}
      alt="UBS-Mux"
      style={{ height: size, width: "auto" }}
      className={cn("block shrink-0 select-none", className)}
      draggable={false}
    />
  );
}
