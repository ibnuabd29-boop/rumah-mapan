export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-8 w-56 animate-pulse rounded bg-line" />
      <div className="h-5 w-96 animate-pulse rounded bg-line" />
      <div className="h-28 w-full animate-pulse rounded-lg bg-line/60" />
      <div className="h-40 w-full animate-pulse rounded-lg bg-line/40" />
    </div>
  );
}
