#include <uiohook.h>

int test_uiohook_worker_start(dispatcher_t dispatch_proc);
int test_uiohook_worker_stop(void);
void test_hook_post_event(uiohook_event* const event);

// Compile the production addon with a deterministic worker backend. This keeps
// the cleanup policy under test while avoiding a real global input hook.
#define uiohook_worker_start test_uiohook_worker_start
#define uiohook_worker_stop test_uiohook_worker_stop
#define hook_post_event test_hook_post_event
#include "../../src/lib/addon.c"
#undef hook_post_event
#undef uiohook_worker_stop
#undef uiohook_worker_start

int test_uiohook_worker_start(dispatcher_t dispatch_proc) {
  (void)dispatch_proc;
  return UIOHOOK_SUCCESS;
}

int test_uiohook_worker_stop(void) {
  return UIOHOOK_FAILURE;
}

void test_hook_post_event(uiohook_event* const event) {
  (void)event;
}
