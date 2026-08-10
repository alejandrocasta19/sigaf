import { cn } from "@/shared/kernel/utils";

export function Avatar({
  name,
  src,
  className,
}: {
  name: string;
  src?: string | null;
  className?: string;
}) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={name} className={cn("h-9 w-9 rounded-full object-cover", className)} />
    );
  }
  return (
    <div
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white",
        className
      )}
    >
      {initials}
    </div>
  );
}
