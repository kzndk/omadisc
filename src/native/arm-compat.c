#define _GNU_SOURCE
#include <dlfcn.h>
#include <errno.h>
#include <limits.h>
#include <pthread.h>
#include <stdlib.h>
#include <string.h>
#include <sys/auxv.h>
#include <unistd.h>
#include "arm-caps.h"

typedef unsigned long (*auxval_fn)(unsigned long);
static auxval_fn original;
static int mask_sme;
static pthread_once_t initialized = PTHREAD_ONCE_INIT;

static void initialize(void) {
  original = (auxval_fn)dlsym(RTLD_NEXT, "getauxval");
  if (!original) _exit(126);
#ifdef __aarch64__
  /* A child such as xdg-open may inherit LD_PRELOAD: never change its caps.
   * Both the expected binary name AND canonical adjacent-library directory
   * must match. No system library or global CPU configuration is modified. */
  char exe[PATH_MAX], library[PATH_MAX];
  Dl_info info;
  ssize_t length = readlink("/proc/self/exe", exe, sizeof(exe) - 1);
  if (length <= 0 || length >= (ssize_t)sizeof(exe) - 1) return;
  exe[length] = '\0';
  char *base = strrchr(exe, '/');
  if (!base || (strcmp(base + 1, "omadisc-bin") && strcmp(base + 1, "electron"))) return;
  if (!dladdr((void *)&getauxval, &info) || !realpath(info.dli_fname, library)) return;
  char *libbase = strrchr(library, '/');
  if (!libbase) return;
  *base = '\0'; *libbase = '\0';
  if (strcmp(exe, library)) return;
  mask_sme = !(original(AT_HWCAP) & (1UL << 22)) && !!(original(AT_HWCAP2) & (1UL << 23));
#endif
}

unsigned long getauxval(unsigned long type) {
  int saved_errno = errno;
  pthread_once(&initialized, initialize);
  errno = saved_errno;
  unsigned long result = original(type);
  return mask_sme ? omadisc_mask_caps(type, result, 0) : result;
}
