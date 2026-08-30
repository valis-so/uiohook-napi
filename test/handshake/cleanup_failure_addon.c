#include <node_api.h>
#include <stdbool.h>
#include <uiohook.h>

int test_uiohook_worker_start(dispatcher_t dispatch_proc);
int test_uiohook_worker_stop(void);
void test_hook_post_event(uiohook_event* const event);
napi_status test_napi_call_threadsafe_function(
  napi_threadsafe_function func,
  void* data,
  napi_threadsafe_function_call_mode mode);

// Compile the production addon with a deterministic worker backend. This keeps
// the cleanup policy under test while avoiding a real global input hook.
#define uiohook_worker_start test_uiohook_worker_start
#define uiohook_worker_stop test_uiohook_worker_stop
#define hook_post_event test_hook_post_event
#define napi_call_threadsafe_function test_napi_call_threadsafe_function
#include "../../src/lib/addon.c"
#undef napi_call_threadsafe_function
#undef hook_post_event
#undef uiohook_worker_stop
#undef uiohook_worker_start

static bool dispatch_called;

int test_uiohook_worker_start(dispatcher_t dispatch_proc) {
  (void)dispatch_proc;
  dispatch_called = false;
  return UIOHOOK_SUCCESS;
}

int test_uiohook_worker_stop(void) {
  return dispatch_called ? UIOHOOK_SUCCESS : UIOHOOK_FAILURE;
}

void test_hook_post_event(uiohook_event* const event) {
  dispatch_proc(event);
}

napi_status test_napi_call_threadsafe_function(
  napi_threadsafe_function func,
  void* data,
  napi_threadsafe_function_call_mode mode) {
  (void)func;
  (void)mode;

  int lock_status = uv_mutex_trylock(&lifecycle_mutex);
  if (lock_status != 0) {
    free(data);
    return napi_generic_failure;
  }

  uv_mutex_unlock(&lifecycle_mutex);
  dispatch_called = true;
  free(data);
  return napi_ok;
}
