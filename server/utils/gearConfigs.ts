/**
 * Field bounds for `saved_gear_configs`, shared by the create and update
 * routes so a config that passes on POST cannot fail on PUT.
 *
 * `tire` and `gearset` are display LABELS, not enums — the calculator writes
 * things like "165/70R10" or "2.583, 1.644, 1.25, 1.0" — so they are bounded
 * strings rather than allowlisted values. The three drive fields are stored as
 * text but represent numbers, so they are bounded tightly. RPM is generous on
 * purpose: the UI offers up to 9000, but a config is the user's own record of
 * their own engine, not a spec we police; the bound exists to keep NaN and
 * absurd values out of the column, nothing more.
 */
export const GEAR_CONFIG_LIMITS = {
  nameMaxLength: 100,
  labelMaxLength: 200,
  driveMaxLength: 50,
  rpmMin: 1,
  rpmMax: 20000,
  /** Saved configs per user. */
  maxPerUser: 25,
} as const;
