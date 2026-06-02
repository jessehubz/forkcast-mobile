// ── Diner side — teal-green editorial (chance. color world) ───────────────────
export const D = {
  bg:            "#080F0D",   // near-black with teal undertone — alive, not dead
  bgWarm:        "#0C1410",
  surface:       "#0F1C18",   // barely lighter than bg
  surfaceRaised: "#162420",
  border:        "#1C3028",   // subtle, not heavy
  borderLight:   "#122018",
  text:          "#E4EFE8",   // near-white with slight teal tint
  textSub:       "#56887A",   // muted teal-green
  textDim:       "#2C4E44",
  accent:        "#8EAD13",   // vivid teal-green — the gradient's brightest point
  accentMid:     "#26E4BC",
  accentLight:   "#082620",   // very dark teal for accent bg tints
  success:       "#2ECC8A",   // sage green
  successBg:     "#092018",
  warning:       "#D4A030",
  warningBg:     "#251E08",
  danger:        "#E05060",
  dangerBg:      "#2A1015",
  white:         "#E4EFE8",
  black:         "#080F0D",
} as const;

// ── Owner side — same dark base, amber accent ──────────────────────────────────
export const O = {
  bg:           "#080F0D",
  bgSurface:    "#0C1410",
  surface:      "#0F1C18",
  surfaceHigh:  "#162420",
  border:       "#1C3028",
  borderLight:  "#122018",
  text:         "#EDE8DC",
  textSub:      "#9E9280",
  textDim:      "#5E5448",
  accent:       "#C9922A",
  accentMid:    "#D9A840",
  accentWarm:   "#201508",
  success:      "#2ECC8A",
  successBg:    "#092018",
  warning:      "#E8A030",
  warningBg:    "#2A1E08",
  danger:       "#E05060",
  dangerBg:     "#2A1015",
  white:        "#EDE8DC",
  black:        "#080F0D",
} as const;

// ── Legacy Colors (backward compat) ───────────────────────────────────────────
export const Colors = {
  bg:           D.bg,
  bgSecondary:  D.bgWarm,
  surface:      D.surface,
  surfaceRaised:D.surfaceRaised,
  border:       D.border,
  borderLight:  D.borderLight,
  maroon:       D.accent,
  maroonLight:  D.accentMid,
  maroonMuted:  D.accentLight,
  cream:        D.text,
  creamMuted:   D.textSub,
  creamDim:     D.textDim,
  success:      D.success,
  successBg:    D.successBg,
  warning:      D.warning,
  warningBg:    D.warningBg,
  danger:       D.danger,
  dangerBg:     D.dangerBg,
  info:         "#4A8FC0",
  infoBg:       "#0E2035",
  white:        "#FFFFFF",
  black:        D.black,
} as const;

// ── Shadows ───────────────────────────────────────────────────────────────────
export const Shadow = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8,
  },
  accent: {
    shadowColor: D.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 6,
  },
} as const;

// ── Cuisine cover palettes ────────────────────────────────────────────────────
export const CuisinePalette: Record<string, { bg: string; mid: string }> = {
  Italian:       { bg: "#1A0A12", mid: "#5A1A38" },
  Japanese:      { bg: "#07121A", mid: "#163248" },
  Filipino:      { bg: "#150D04", mid: "#3E2808" },
  Western:       { bg: "#081408", mid: "#183018" },
  Korean:        { bg: "#100A1E", mid: "#2E1A4E" },
  Chinese:       { bg: "#180404", mid: "#481414" },
  French:        { bg: "#080A16", mid: "#181E48" },
  Indian:        { bg: "#180A00", mid: "#482008" },
  Mediterranean: { bg: "#041208", mid: "#0E3020" },
  default:       { bg: "#0A0F0D", mid: "#1A2C24" },
};

// ── Status helpers — diner ────────────────────────────────────────────────────
export const statusColor = (status: string): string => {
  switch (status) {
    case "confirmed":  return D.accent;
    case "approved":   return D.success;
    case "seated":     return "#5A9EE8";
    case "completed":  return D.textSub;
    case "no_show":    return D.danger;
    case "cancelled":  return D.danger;
    case "pending":    return D.warning;
    case "rejected":   return D.danger;
    default:           return D.textSub;
  }
};

export const statusBg = (status: string): string => {
  switch (status) {
    case "confirmed":  return D.accentLight;
    case "approved":   return D.successBg;
    case "seated":     return "#142038";
    case "completed":  return D.surfaceRaised;
    case "no_show":    return D.dangerBg;
    case "cancelled":  return D.dangerBg;
    case "pending":    return D.warningBg;
    case "rejected":   return D.dangerBg;
    default:           return D.surfaceRaised;
  }
};

export const statusLabel = (status: string): string => {
  const map: Record<string, string> = {
    confirmed: "Confirmed", approved: "Approved",   seated: "Seated",
    completed: "Completed", no_show:  "No Show",    cancelled: "Cancelled",
    pending:   "Pending",   rejected: "Rejected",
  };
  return map[status] ?? status;
};

// ── Status helpers — owner ────────────────────────────────────────────────────
export const ownerStatusColor = (status: string): string => {
  switch (status) {
    case "confirmed":  return O.accent;
    case "approved":   return O.success;
    case "seated":     return "#5A9EE8";
    case "completed":  return O.textSub;
    case "no_show":    return O.danger;
    case "cancelled":  return O.danger;
    case "pending":    return O.warning;
    case "rejected":   return O.danger;
    default:           return O.textSub;
  }
};

export const ownerStatusBg = (status: string): string => {
  switch (status) {
    case "confirmed":  return O.accentWarm;
    case "approved":   return O.successBg;
    case "seated":     return "#142038";
    case "completed":  return O.surfaceHigh;
    case "no_show":    return O.dangerBg;
    case "cancelled":  return O.dangerBg;
    case "pending":    return O.warningBg;
    case "rejected":   return O.dangerBg;
    default:           return O.surfaceHigh;
  }
};
