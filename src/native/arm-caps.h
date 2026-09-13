#ifndef OMADISC_ARM_CAPS_H
#define OMADISC_ARM_CAPS_H
/* Linux UAPI ARM feature bits, not a fabricated host platform.
 * Only suppress SME-family optimization dispatch when SVE is unavailable.
 * Retain mandatory NEON and every unrelated capability. */
static inline unsigned long omadisc_mask_caps(unsigned long type,
                                              unsigned long value,
                                              int has_sve) {
  if (has_sve) return value;
  if (type == 16) return value & ~(0x3fUL << 42); /* AT_HWCAP: SME2.2+ */
  if (type == 26) return value & ~((0xffUL << 23) | (0x3fUL << 37) | (0x3fUL << 57));
  if (type == 29) return value & ~(3UL << 6); /* AT_HWCAP3: SME LUT6/2.3 */
  return value;
}
#endif
