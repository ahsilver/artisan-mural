import { Button } from "@/components/ui/button";
import type { Unit } from "@/lib/catalog";
import type { WallSelection } from "@/lib/wall-selection";

const input = "mt-2 h-12 w-full rounded-sm border border-input bg-background px-3 text-base text-foreground outline-none focus:ring-1 focus:ring-ring";

export function WallMeasurements({ selection, onChange }: { selection: WallSelection; onChange: (selection: WallSelection) => void }) {
  function changeUnit(unit: Unit) {
    const scale = { cm: 1, in: 2.54, ft: 30.48 };
    onChange({ ...selection, unit, width: Math.round(selection.width * scale[selection.unit] / scale[unit] * 100) / 100, height: Math.round(selection.height * scale[selection.unit] / scale[unit] * 100) / 100 });
  }
  const set = (key: "width" | "height", n: number) => { if (n > 0 && n <= 100000) onChange({ ...selection, [key]: n }); };
  return <div>
    <div className="flex items-center justify-between gap-3"><h3 className="text-base">Your wall size</h3><div className="flex gap-1" aria-label="Measurement unit">{(["ft", "in", "cm"] as Unit[]).map(unit => <Button key={unit} variant={selection.unit === unit ? "secondary" : "ghost"} size="sm" onClick={() => changeUnit(unit)}>{unit}</Button>)}</div></div>
    <div className="mt-3 grid grid-cols-2 gap-4">{(["width", "height"] as const).map(key => {
      const name = key === "width" ? "Width" : "Height";
      if (selection.unit === "ft") {
        const total = selection[key];
        let feet = Math.floor(total + 1e-9);
        let inches = Math.round((total - feet) * 12 * 10) / 10;
        if (inches >= 12) { feet += 1; inches = 0; }
        return <fieldset key={key} className="text-xs text-muted-foreground"><legend>{name}</legend><div className="grid grid-cols-2 gap-2">
          <label className="relative">
            <input aria-label={`${name} feet`} type="number" min="0" step="1" value={feet} className={input + " pr-8"} onChange={e => set(key, Math.max(0, Math.floor(Number(e.target.value) || 0)) + inches / 12)} />
            <span className="pointer-events-none absolute right-3 top-[1.65rem] text-xs">ft</span>
          </label>
          <label className="relative">
            <input aria-label={`${name} inches`} type="number" min="0" max="11.9" step="any" value={inches} className={input + " pr-8"} onChange={e => set(key, feet + Math.min(11.9, Math.max(0, Number(e.target.value) || 0)) / 12)} />
            <span className="pointer-events-none absolute right-3 top-[1.65rem] text-xs">in</span>
          </label>
        </div></fieldset>;
      }
      return <label key={key} className="text-xs text-muted-foreground">{name} ({selection.unit})<input aria-label={`${name} (${selection.unit})`} type="number" min="0.01" max="100000" step="any" value={selection[key]} className={input} onChange={e => set(key, Number(e.target.value))} /></label>;
    })}</div>
  </div>;
}
