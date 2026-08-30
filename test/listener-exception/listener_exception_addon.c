#include <node_api.h>
#include "napi_helpers.h"

static void call_js(napi_env env, napi_value js_callback, void* context, void* data) {
  (void)context;
  (void)data;

  if (env == NULL || js_callback == NULL) return;

  napi_value global;
  napi_status status = napi_get_global(env, &global);
  NAPI_FATAL_IF_FAILED(status, "call_js", "napi_get_global");

  status = napi_call_function(env, global, js_callback, 0, NULL, NULL);
  uiohook_napi_handle_callback_status(env, status, "call_js", "napi_call_function");
}

static napi_value trigger(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value callback;
  napi_status status = napi_get_cb_info(env, info, &argc, &callback, NULL, NULL);
  NAPI_FATAL_IF_FAILED(status, "trigger", "napi_get_cb_info");

  napi_value resource_name;
  status = napi_create_string_utf8(
    env,
    "uiohook listener exception test",
    NAPI_AUTO_LENGTH,
    &resource_name);
  NAPI_FATAL_IF_FAILED(status, "trigger", "napi_create_string_utf8");

  napi_threadsafe_function threadsafe_function;
  status = napi_create_threadsafe_function(
    env,
    callback,
    NULL,
    resource_name,
    0,
    1,
    NULL,
    NULL,
    NULL,
    call_js,
    &threadsafe_function);
  NAPI_FATAL_IF_FAILED(status, "trigger", "napi_create_threadsafe_function");

  status = napi_call_threadsafe_function(
    threadsafe_function,
    NULL,
    napi_tsfn_nonblocking);
  NAPI_FATAL_IF_FAILED(status, "trigger", "napi_call_threadsafe_function");

  status = napi_release_threadsafe_function(
    threadsafe_function,
    napi_tsfn_release);
  NAPI_FATAL_IF_FAILED(status, "trigger", "napi_release_threadsafe_function");

  return NULL;
}

NAPI_MODULE_INIT() {
  napi_value trigger_function;
  napi_status status = napi_create_function(
    env,
    "trigger",
    NAPI_AUTO_LENGTH,
    trigger,
    NULL,
    &trigger_function);
  NAPI_FATAL_IF_FAILED(status, "NAPI_MODULE_INIT", "napi_create_function");

  status = napi_set_named_property(env, exports, "trigger", trigger_function);
  NAPI_FATAL_IF_FAILED(status, "NAPI_MODULE_INIT", "napi_set_named_property");

  return exports;
}
