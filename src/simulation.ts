export type Params = {
  rpm: number;
  temperature: number;
  vibration: number;
  current: number;
  load: number;
};
export type Key = keyof Params;
export type Severity = "Normal" | "Warning" | "Critical";
export type Machine = {
  id: string;
  name: string;
  params: Params;
  power: boolean;
  running: boolean;
  paused: boolean;
};
export type Thresholds = Record<
  Exclude<Key, "load">,
  { warning: number; critical: number }
>;
export const fields: {
  key: Key;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  color: string;
}[] = [
  {
    key: "rpm",
    label: "Rotational speed",
    unit: "RPM",
    min: 0,
    max: 5000,
    step: 10,
    color: "#42d5dd",
  },
  {
    key: "temperature",
    label: "Temperature",
    unit: "°C",
    min: 20,
    max: 150,
    step: 1,
    color: "#f5ac64",
  },
  {
    key: "vibration",
    label: "Vibration",
    unit: "mm/s",
    min: 0,
    max: 15,
    step: 0.1,
    color: "#a89bff",
  },
  {
    key: "current",
    label: "Electrical current",
    unit: "A",
    min: 0,
    max: 25,
    step: 0.1,
    color: "#75c9ff",
  },
  {
    key: "load",
    label: "Machine load",
    unit: "%",
    min: 0,
    max: 100,
    step: 1,
    color: "#42d5dd",
  },
];
export const defaultThresholds: Thresholds = {
  temperature: { warning: 70, critical: 90 },
  vibration: { warning: 4, critical: 8 },
  rpm: { warning: 3000, critical: 4000 },
  current: { warning: 12, critical: 18 },
};
export const defaults: Params[] = [
  { rpm: 1800, temperature: 45, vibration: 1.5, current: 6, load: 40 },
  { rpm: 2500, temperature: 65, vibration: 3, current: 10, load: 65 },
  { rpm: 3200, temperature: 85, vibration: 6.5, current: 15, load: 85 },
];
export const makeMachines = (): Machine[] =>
  ["Main production motor", "Assembly line motor", "Heavy duty motor"].map(
    (name, i) => ({
      id: `MOTOR-0${i + 1}`,
      name,
      params: { ...defaults[i] },
      power: true,
      running: true,
      paused: false,
    }),
  );
export function severity(
  key: Key,
  value: number,
  thresholds: Thresholds,
): Severity {
  if (key === "load") return "Normal";
  const t = thresholds[key];
  if (value > t.critical) return "Critical";
  if (key === "rpm" ? value > t.warning : value >= t.warning) return "Warning";
  return "Normal";
}
export function condition(params: Params, thresholds: Thresholds): Severity {
  const levels = fields.map((f) => severity(f.key, params[f.key], thresholds));
  return levels.includes("Critical")
    ? "Critical"
    : levels.includes("Warning")
      ? "Warning"
      : "Normal";
}
export const suggestions: Record<Exclude<Key, "load">, string> = {
  temperature:
    "Possible thermal issue. Inspect the cooling system and motor ventilation.",
  vibration:
    "Possible bearing or alignment issue. Inspect bearings, coupling and mounting bolts.",
  current:
    "Possible electrical overload. Inspect supply, wiring and driven equipment.",
  rpm: "Overspeed condition. Inspect the speed controller and operating setpoint.",
};
export type Alert = {
  id: string;
  machine: string;
  parameter: Key;
  value: number;
  threshold: number;
  severity: Severity;
  time: number;
  action: string;
};
export function crossings(
  before: Machine,
  after: Machine,
  oldT: Thresholds,
  t: Thresholds,
): Alert[] {
  return fields
    .filter((f) => f.key !== "load")
    .flatMap((f) => {
      const key = f.key as Exclude<Key, "load">;
      const was = severity(key, before.params[key], oldT),
        now = severity(key, after.params[key], t);
      if (was === now) return [];
      return [
        {
          id: crypto.randomUUID(),
          machine: after.id,
          parameter: key,
          value: after.params[key],
          threshold: now === "Critical" ? t[key].critical : t[key].warning,
          severity: now,
          time: Date.now(),
          action:
            now === "Normal"
              ? "Parameter returned to normal operating range."
              : suggestions[key],
        },
      ];
    });
}
export const presets: { name: string; short: string; params: Params }[] = [
  { name: "Healthy operation", short: "Nominal", params: { ...defaults[0] } },
  {
    name: "Motor overheating",
    short: "Thermal",
    params: { ...defaults[0], temperature: 110 },
  },
  {
    name: "Bearing vibration fault",
    short: "Bearing",
    params: { ...defaults[0], vibration: 10 },
  },
  {
    name: "Critical multi-fault",
    short: "Multi-fault",
    params: {
      rpm: 4500,
      temperature: 120,
      vibration: 12,
      current: 22,
      load: 95,
    },
  },
];
export function restoreMachines(): Machine[] {
  try {
    const stored = JSON.parse(localStorage.getItem("axiom-machines") || "null");
    if (!Array.isArray(stored) || stored.length !== 3) return makeMachines();
    return makeMachines().map((m, i) => ({
      ...m,
      params: Object.fromEntries(
        fields.map((f) => [
          f.key,
          typeof stored[i]?.params?.[f.key] === "number" &&
          Number.isFinite(stored[i].params[f.key])
            ? Math.min(f.max, Math.max(f.min, stored[i].params[f.key]))
            : m.params[f.key],
        ]),
      ) as Params,
      power: stored[i]?.power !== false,
      running: stored[i]?.running !== false,
    }));
  } catch {
    return makeMachines();
  }
}
