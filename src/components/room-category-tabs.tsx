import { ROOM_CATEGORIES, SAMPLE_TYPES, categoryOf } from "@/lib/room-mask";

/** Home / Office / Healthcare tabs over the sample rooms (only categories that have rooms). */
export const usedCategories = () => ROOM_CATEGORIES.filter((c) => SAMPLE_TYPES.some((t) => categoryOf(t) === c.id));
export function RoomCategoryTabs({ value, onChange, counts }: { value: string; onChange: (c: string) => void; counts?: Record<string, number> }) {
  const cats = usedCategories();
  if (cats.length < 2) return null;
  return <div role="tablist" aria-label="Room type" data-testid="room-category-tabs" className="flex gap-4 text-xs">
    {cats.map((c) => <button key={c.id} type="button" role="tab" aria-selected={value === c.id} onClick={() => onChange(c.id)}
      className={`-mb-px border-b pb-1 transition-colors ${value === c.id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
      style={{ background: "none", cursor: "pointer" }}>{c.name}{counts?.[c.id] ? <span className="ml-1 opacity-60">{counts[c.id]}</span> : null}</button>)}
  </div>;
}
