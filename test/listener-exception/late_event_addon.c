#include <node_api.h>
#include <stdio.h>
#include <uiohook.h>

static napi_status trace_define_properties(
  napi_env env,
  napi_value object,
  size_t count,
  const napi_property_descriptor* descriptors) {
  napi_status status = napi_define_properties(env, object, count, descriptors);
  bool pending = true;
  if (status == napi_pending_exception &&
      napi_is_exception_pending(env, &pending) == napi_ok && !pending) {
    fputs("late input reached event conversion with JS disabled\n", stderr);
  }
  return status;
}

// Use the production event queue and conversion without an OS input hook.
#undef NAPI_MODULE_INIT
#define NAPI_MODULE_INIT() static napi_value init_addon(napi_env env, napi_value exports)
#define napi_define_properties trace_define_properties
#include "../../src/lib/addon.c"
#undef napi_define_properties

int uiohook_worker_start(dispatcher_t dispatch) {
  (void)dispatch;
  return UIOHOOK_SUCCESS;
}

int uiohook_worker_stop(void) {
  return UIOHOOK_SUCCESS;
}

void hook_post_event(uiohook_event* const event) {
  (void)event;
}

static uint16_t test_event_type(napi_env env, napi_callback_info info) {
  uint32_t index;
  size_t argc = 1;
  napi_value arg;
  napi_status status = napi_get_cb_info(env, info, &argc, &arg, NULL, NULL);
  NAPI_FATAL_IF_FAILED(status, "queue_event", "napi_get_cb_info");
  if (argc != 1) abort();

  status = napi_get_value_uint32(env, arg, &index);
  NAPI_FATAL_IF_FAILED(status, "queue_event", "napi_get_value_uint32");
  const uint16_t types[] = { EVENT_KEY_PRESSED, EVENT_MOUSE_MOVED, EVENT_MOUSE_WHEEL };
  if (index >= sizeof(types) / sizeof(types[0])) abort();

  return types[index];
}

static napi_value queue_event(napi_env env, napi_callback_info info) {
  uiohook_event event = { .type = test_event_type(env, info) };
  dispatch_proc(&event);
  return NULL;
}

typedef struct {
  napi_env env;
  uv_loop_t* loop;
  uiohook_event event;
} cleanup_event;

static void queue_during_cleanup(void* context) {
  cleanup_event* pending = context;
  // The TSFN was unreferenced to allow natural exit; keep this poll live.
  napi_status status = napi_ref_threadsafe_function(pending->env, active_owner->threadsafe_fn);
  NAPI_FATAL_IF_FAILED(status, "queue_during_cleanup", "napi_ref_threadsafe_function");
  dispatch_proc(&pending->event);
  uv_run(pending->loop, UV_RUN_NOWAIT);
  free(pending);
}

static napi_value arm_cleanup_event(napi_env env, napi_callback_info info) {
  uint16_t type = test_event_type(env, info);
  cleanup_event* pending = calloc(1, sizeof(*pending));
  if (pending == NULL) abort();
  pending->env = env;
  pending->event.type = type;
  napi_status status = napi_get_uv_event_loop(env, &pending->loop);
  NAPI_FATAL_IF_FAILED(status, "arm_cleanup_event", "napi_get_uv_event_loop");

  // Cleanup hooks run in reverse registration order. Poll the real TSFN
  // after JS has been disabled but before the addon's cleanup closes it.
  status = napi_add_env_cleanup_hook(env, queue_during_cleanup, pending);
  NAPI_FATAL_IF_FAILED(status, "arm_cleanup_event", "napi_add_env_cleanup_hook");
  status = napi_unref_threadsafe_function(env, active_owner->threadsafe_fn);
  NAPI_FATAL_IF_FAILED(status, "arm_cleanup_event", "napi_unref_threadsafe_function");
  return NULL;
}

NAPI_MODULE_EXPORT int32_t NODE_API_MODULE_GET_API_VERSION(void) {
  return NAPI_VERSION;
}

NAPI_MODULE_EXPORT napi_value NAPI_MODULE_INITIALIZER(napi_env env, napi_value exports) {
  init_addon(env, exports);
  const napi_property_descriptor properties[] = {
    { .utf8name = "queueEvent", .method = queue_event },
    { .utf8name = "armCleanupEvent", .method = arm_cleanup_event },
  };
  napi_status status = napi_define_properties(
    env, exports, sizeof(properties) / sizeof(properties[0]), properties);
  NAPI_FATAL_IF_FAILED(status, "NAPI_MODULE_INIT", "napi_define_properties");
  return exports;
}
