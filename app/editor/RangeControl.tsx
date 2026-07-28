type RangeControlProps = {
  label: string;
  value: number;
  valueLabel: string;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
};

export function RangeControl({
  label,
  value,
  valueLabel,
  min,
  max,
  step,
  onChange,
}: RangeControlProps) {
  return (
    <label className="range-field">
      <span>
        {label} <strong>{valueLabel}</strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
