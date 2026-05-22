import type { SportKind, WorkoutSessionType } from "../../../types/api";
import type { HealthIconName } from "./Icon";

export interface SportMeta {
  kind: SportKind;
  labelRu: string;
  labelEn: string;
  icon: HealthIconName;
  accent: string;
  defaultSessionType: WorkoutSessionType;
  isOutdoor: boolean;
  isStrength: boolean;
}

export const SPORTS: Record<SportKind, SportMeta> = {
  running: {
    kind: "running",
    labelRu: "Бег",
    labelEn: "Running",
    icon: "running",
    accent: "#1F9D6B",
    defaultSessionType: "cardio",
    isOutdoor: true,
    isStrength: false,
  },
  cycling: {
    kind: "cycling",
    labelRu: "Велосипед",
    labelEn: "Cycling",
    icon: "cycling",
    accent: "#2C8DD9",
    defaultSessionType: "cardio",
    isOutdoor: true,
    isStrength: false,
  },
  mtb: {
    kind: "mtb",
    labelRu: "Маунтинбайк",
    labelEn: "MTB",
    icon: "cycling",
    accent: "#925B2F",
    defaultSessionType: "cardio",
    isOutdoor: true,
    isStrength: false,
  },
  gravel: {
    kind: "gravel",
    labelRu: "Гравий",
    labelEn: "Gravel",
    icon: "cycling",
    accent: "#A07B4A",
    defaultSessionType: "cardio",
    isOutdoor: true,
    isStrength: false,
  },
  walking: {
    kind: "walking",
    labelRu: "Ходьба",
    labelEn: "Walking",
    icon: "running",
    accent: "#5C7A6E",
    defaultSessionType: "cardio",
    isOutdoor: true,
    isStrength: false,
  },
  hiking: {
    kind: "hiking",
    labelRu: "Хайкинг",
    labelEn: "Hiking",
    icon: "mountain",
    accent: "#6B7F4A",
    defaultSessionType: "cardio",
    isOutdoor: true,
    isStrength: false,
  },
  swim_pool: {
    kind: "swim_pool",
    labelRu: "Бассейн",
    labelEn: "Pool Swim",
    icon: "swimming",
    accent: "#1B8FBF",
    defaultSessionType: "cardio",
    isOutdoor: false,
    isStrength: false,
  },
  swim_open_water: {
    kind: "swim_open_water",
    labelRu: "Открытая вода",
    labelEn: "Open Water",
    icon: "swimming",
    accent: "#125F87",
    defaultSessionType: "cardio",
    isOutdoor: true,
    isStrength: false,
  },
  ski: {
    kind: "ski",
    labelRu: "Лыжи",
    labelEn: "Skiing",
    icon: "skiing",
    accent: "#7488A5",
    defaultSessionType: "cardio",
    isOutdoor: true,
    isStrength: false,
  },
  snowboard: {
    kind: "snowboard",
    labelRu: "Сноуборд",
    labelEn: "Snowboard",
    icon: "skiing",
    accent: "#5C708D",
    defaultSessionType: "cardio",
    isOutdoor: true,
    isStrength: false,
  },
  climb: {
    kind: "climb",
    labelRu: "Скалолазание",
    labelEn: "Climbing",
    icon: "climbing",
    accent: "#A05030",
    defaultSessionType: "sport",
    isOutdoor: false,
    isStrength: true,
  },
  mountaineering: {
    kind: "mountaineering",
    labelRu: "Альпинизм",
    labelEn: "Mountaineering",
    icon: "mountain",
    accent: "#7E5538",
    defaultSessionType: "sport",
    isOutdoor: true,
    isStrength: false,
  },
  row: {
    kind: "row",
    labelRu: "Гребля",
    labelEn: "Rowing",
    icon: "rowing",
    accent: "#1F8F8F",
    defaultSessionType: "cardio",
    isOutdoor: false,
    isStrength: false,
  },
  kayak: {
    kind: "kayak",
    labelRu: "Каяк",
    labelEn: "Kayak",
    icon: "rowing",
    accent: "#137575",
    defaultSessionType: "cardio",
    isOutdoor: true,
    isStrength: false,
  },
  sup: {
    kind: "sup",
    labelRu: "SUP",
    labelEn: "SUP",
    icon: "rowing",
    accent: "#1FA0A0",
    defaultSessionType: "cardio",
    isOutdoor: true,
    isStrength: false,
  },
  golf: {
    kind: "golf",
    labelRu: "Гольф",
    labelEn: "Golf",
    icon: "golf",
    accent: "#3A8B4F",
    defaultSessionType: "sport",
    isOutdoor: true,
    isStrength: false,
  },
  yoga: {
    kind: "yoga",
    labelRu: "Йога",
    labelEn: "Yoga",
    icon: "yoga",
    accent: "#7B6FD8",
    defaultSessionType: "mobility",
    isOutdoor: false,
    isStrength: false,
  },
  pilates: {
    kind: "pilates",
    labelRu: "Пилатес",
    labelEn: "Pilates",
    icon: "yoga",
    accent: "#8E80E0",
    defaultSessionType: "mobility",
    isOutdoor: false,
    isStrength: false,
  },
  hiit: {
    kind: "hiit",
    labelRu: "HIIT",
    labelEn: "HIIT",
    icon: "flame",
    accent: "#D34A2D",
    defaultSessionType: "hiit",
    isOutdoor: false,
    isStrength: false,
  },
  dance: {
    kind: "dance",
    labelRu: "Танцы",
    labelEn: "Dance",
    icon: "sparkles",
    accent: "#D67BB0",
    defaultSessionType: "cardio",
    isOutdoor: false,
    isStrength: false,
  },
  other: {
    kind: "other",
    labelRu: "Другое",
    labelEn: "Other",
    icon: "dumbbell",
    accent: "#5C7A6E",
    defaultSessionType: "sport",
    isOutdoor: false,
    isStrength: false,
  },
};

export const STRENGTH_LABEL = {
  labelRu: "Силовая",
  labelEn: "Strength",
  icon: "barbell" as HealthIconName,
  accent: "#0F7A52",
};

export function sportLabel(kind: SportKind | null | undefined): string {
  if (!kind) return STRENGTH_LABEL.labelRu;
  return SPORTS[kind]?.labelRu ?? "Другое";
}

export function sportAccent(kind: SportKind | null | undefined): string {
  if (!kind) return STRENGTH_LABEL.accent;
  return SPORTS[kind]?.accent ?? "#5C7A6E";
}

export function sportIcon(kind: SportKind | null | undefined): HealthIconName {
  if (!kind) return STRENGTH_LABEL.icon;
  return SPORTS[kind]?.icon ?? "dumbbell";
}

export const MUSCLE_LABEL: Record<string, string> = {
  chest: "Грудь",
  back: "Спина",
  lats: "Широчайшие",
  traps: "Трапеции",
  delts_front: "Передние дельты",
  delts_side: "Средние дельты",
  delts_rear: "Задние дельты",
  biceps: "Бицепс",
  triceps: "Трицепс",
  forearms: "Предплечья",
  quads: "Квадрицепс",
  hamstrings: "Бицепс бедра",
  glutes: "Ягодицы",
  calves: "Икры",
  abs: "Пресс",
  obliques: "Косые",
  lower_back: "Поясница",
  neck: "Шея",
  full_body: "Всё тело",
};

export function muscleGroupLabel(muscle: string): string {
  return MUSCLE_LABEL[muscle] ?? muscle;
}

export function formatPace(secondsPerKm: number | null | undefined): string {
  if (!secondsPerKm || secondsPerKm <= 0) return "—";
  const m = Math.floor(secondsPerKm / 60);
  const s = secondsPerKm % 60;
  return `${m}:${String(s).padStart(2, "0")}/км`;
}

export function formatDuration(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return "—";
  if (minutes < 60) return `${minutes} мин`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}ч ${m}м` : `${h}ч`;
}

export function formatVolume(kg: number | null | undefined): string {
  if (!kg || kg <= 0) return "0 кг";
  if (kg < 1000) return `${Math.round(kg)} кг`;
  return `${(kg / 1000).toFixed(1)} т`;
}
