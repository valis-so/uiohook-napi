#include <node_api.h>
#include <stdbool.h>
#include <string.h>
#include <uiohook.h>
#include <uv.h>

typedef enum {
  TEST_NONE = 0,
  TEST_SPURIOUS_WAKE,
  TEST_EARLY_FAILURE,
  TEST_ENABLED_THEN_SUCCESSFUL_EXIT
} test_scenario;

typedef enum {
  STAGE_INITIAL = 0,
  STAGE_SPURIOUS_INJECTED,
  STAGE_OLD_RUNNING_LOCKED,
  STAGE_PATCHED_REWAITING,
  STAGE_OLD_EARLY_SIGNAL,
  STAGE_PATCHED_WORKER_WAITING
} test_stage;

static void test_uv_cond_signal(uv_cond_t* cond);
static void test_uv_cond_wait(uv_cond_t* cond, uv_mutex_t* mutex);
static void test_uv_cond_destroy(uv_cond_t* cond);
static void test_uv_mutex_lock(uv_mutex_t* mutex);
static int test_uv_mutex_trylock(uv_mutex_t* mutex);
static void test_uv_mutex_unlock(uv_mutex_t* mutex);
static void test_uv_mutex_destroy(uv_mutex_t* mutex);
static int test_hook_run(void);
static int test_hook_stop(void);
static void test_hook_set_dispatch_proc(dispatcher_t dispatch_proc);
static void test_hook_set_logger_proc(logger_t logger_proc);

// Compile the real worker implementation, replacing only its OS hook and libuv
// calls with deterministic test shims. A regression in uiohook_worker.c is
// therefore exercised directly instead of against a copied implementation.
#define uv_cond_signal test_uv_cond_signal
#define uv_cond_wait test_uv_cond_wait
#define uv_cond_destroy test_uv_cond_destroy
#define uv_mutex_lock test_uv_mutex_lock
#define uv_mutex_trylock test_uv_mutex_trylock
#define uv_mutex_unlock test_uv_mutex_unlock
#define uv_mutex_destroy test_uv_mutex_destroy
#define hook_run test_hook_run
#define hook_stop test_hook_stop
#define hook_set_dispatch_proc test_hook_set_dispatch_proc
#define hook_set_logger_proc test_hook_set_logger_proc
#include "../../src/lib/uiohook_worker.c"
#undef hook_set_logger_proc
#undef hook_set_dispatch_proc
#undef hook_stop
#undef hook_run
#undef uv_mutex_destroy
#undef uv_mutex_unlock
#undef uv_mutex_trylock
#undef uv_mutex_lock
#undef uv_cond_destroy
#undef uv_cond_wait
#undef uv_cond_signal

static test_scenario scenario;
static test_stage stage;
static uv_mutex_t stage_mutex;
static uv_cond_t stage_cond;
static uv_sem_t allow_enabled;
static uv_sem_t stop_requested;
static uv_sem_t worker_finished;
static uv_thread_t helper_thread;
static uv_key_t worker_thread_key;
static dispatcher_t hook_dispatcher;
static bool worker_owns_control_mutex;
static unsigned int control_wait_calls;
static unsigned int control_mutex_destroy_calls;
static unsigned int control_cond_destroy_calls;

static void set_stage(test_stage next) {
  uv_mutex_lock(&stage_mutex);
  stage = next;
  uv_cond_broadcast(&stage_cond);
  uv_mutex_unlock(&stage_mutex);
}

static bool is_worker_thread(void) {
  return uv_key_get(&worker_thread_key) != NULL;
}

static void spurious_helper(void* arg) {
  (void)arg;

  uv_mutex_lock(&stage_mutex);
  while (stage != STAGE_OLD_RUNNING_LOCKED &&
         stage != STAGE_PATCHED_REWAITING) {
    uv_cond_wait(&stage_cond, &stage_mutex);
  }
  uv_mutex_unlock(&stage_mutex);

  // Old code now owns hook_running_mutex and is about to join; patched code is
  // back inside its predicate wait. Releasing hook_run here makes both
  // interleavings deterministic.
  uv_sem_post(&allow_enabled);
}

static void test_uv_cond_signal(uv_cond_t* cond) {
  if (scenario == TEST_EARLY_FAILURE && cond == &hook_control_cond &&
      is_worker_thread() && !worker_owns_control_mutex) {
    // The old worker signals before taking the control mutex. Publish that
    // ordering to the main-thread shim before sending the intentionally lost
    // signal.
    set_stage(STAGE_OLD_EARLY_SIGNAL);
  }

  uv_cond_signal(cond);

  if (scenario == TEST_ENABLED_THEN_SUCCESSFUL_EXIT &&
      cond == &hook_control_cond && is_worker_thread() &&
      hook_state == HOOK_START_FINISHED) {
    uv_sem_post(&worker_finished);
  }
}

static void test_uv_cond_wait(uv_cond_t* cond, uv_mutex_t* mutex) {
  if (cond != &hook_control_cond) {
    uv_cond_wait(cond, mutex);
    return;
  }

  if (scenario == TEST_SPURIOUS_WAKE) {
    control_wait_calls += 1;
    if (control_wait_calls == 1) {
      // A condition wait is allowed to return while its predicate is still
      // false. Return with the mutex held, exactly as a real spurious wake does.
      set_stage(STAGE_SPURIOUS_INJECTED);
      return;
    }

    set_stage(STAGE_PATCHED_REWAITING);
    uv_cond_wait(cond, mutex);
    return;
  }

  if (scenario == TEST_EARLY_FAILURE) {
    uv_mutex_lock(&stage_mutex);
    while (stage != STAGE_OLD_EARLY_SIGNAL &&
           stage != STAGE_PATCHED_WORKER_WAITING) {
      uv_cond_wait(&stage_cond, &stage_mutex);
    }
    uv_mutex_unlock(&stage_mutex);
  }

  if (scenario == TEST_ENABLED_THEN_SUCCESSFUL_EXIT) {
    // Model the legal schedule where hook_run() returns after reporting enabled
    // but before hook_enable() can reacquire the control mutex.
    uv_mutex_unlock(mutex);
    uv_sem_wait(&worker_finished);
    uv_mutex_lock(mutex);
    return;
  }

  uv_cond_wait(cond, mutex);
}

static void test_uv_cond_destroy(uv_cond_t* cond) {
  if (cond == &hook_control_cond) {
    control_cond_destroy_calls += 1;
  }

  uv_cond_destroy(cond);
}

static void test_uv_mutex_lock(uv_mutex_t* mutex) {
  if (scenario == TEST_EARLY_FAILURE && mutex == &hook_control_mutex &&
      is_worker_thread()) {
    // Patched code attempts this lock before publishing FINISHED. Tell the main
    // thread it can enter the real wait and release the mutex.
    set_stage(STAGE_PATCHED_WORKER_WAITING);
    uv_mutex_lock(mutex);
    worker_owns_control_mutex = true;
    return;
  }

  uv_mutex_lock(mutex);
}

static int test_uv_mutex_trylock(uv_mutex_t* mutex) {
  int result = uv_mutex_trylock(mutex);
  // The old worker has only one trylock: its mutex-as-state probe. The patched
  // worker has none, which also keeps this harness buildable after that mutex is
  // removed.
  if (scenario == TEST_SPURIOUS_WAKE && result == 0) {
    set_stage(STAGE_OLD_RUNNING_LOCKED);
  }
  return result;
}

static void test_uv_mutex_unlock(uv_mutex_t* mutex) {
  if (scenario == TEST_EARLY_FAILURE && mutex == &hook_control_mutex &&
      is_worker_thread()) {
    if (!worker_owns_control_mutex) {
      // Old code unlocks a mutex owned by the caller. Avoid invoking undefined
      // platform behavior while retaining the lost-signal ordering under test.
      return;
    }
    worker_owns_control_mutex = false;
  }

  uv_mutex_unlock(mutex);
}

static void test_uv_mutex_destroy(uv_mutex_t* mutex) {
  if (mutex == &hook_control_mutex) {
    control_mutex_destroy_calls += 1;
  }

  uv_mutex_destroy(mutex);
}

static int test_hook_run(void) {
  uv_key_set(&worker_thread_key, (void*)1);

  if (scenario == TEST_EARLY_FAILURE) {
    return UIOHOOK_ERROR_OUT_OF_MEMORY;
  }

  if (scenario != TEST_ENABLED_THEN_SUCCESSFUL_EXIT) {
    uv_sem_wait(&allow_enabled);
  }

  uiohook_event event = {0};
  event.type = EVENT_HOOK_ENABLED;
  hook_dispatcher(&event);

  if (scenario == TEST_ENABLED_THEN_SUCCESSFUL_EXIT) {
    return UIOHOOK_SUCCESS;
  }

  uv_sem_wait(&stop_requested);
  return UIOHOOK_SUCCESS;
}

static int test_hook_stop(void) {
  uv_sem_post(&stop_requested);
  return UIOHOOK_SUCCESS;
}

static void test_hook_set_dispatch_proc(dispatcher_t dispatch_proc) {
  hook_dispatcher = dispatch_proc;
}

static void test_hook_set_logger_proc(logger_t logger_proc) {
  (void)logger_proc;
}

static void noop_dispatch(uiohook_event* const event) {
  (void)event;
}

static napi_value run_scenario(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value argv[1];
  char name[32];
  size_t name_length = 0;

  // Patched production code intentionally has no trylock call. Keep the shim
  // referenced so warning-clean builds still compile against both revisions.
  (void)test_uv_mutex_trylock;

  if (napi_get_cb_info(env, info, &argc, argv, NULL, NULL) != napi_ok ||
      argc != 1 ||
      napi_get_value_string_utf8(env, argv[0], name, sizeof(name),
                                 &name_length) != napi_ok) {
    napi_throw_type_error(env, NULL, "expected one scenario name");
    return NULL;
  }

  if (strcmp(name, "spurious-wake") == 0) {
    scenario = TEST_SPURIOUS_WAKE;
  } else if (strcmp(name, "early-failure") == 0) {
    scenario = TEST_EARLY_FAILURE;
  } else if (strcmp(name, "enabled-then-successful-exit") == 0) {
    scenario = TEST_ENABLED_THEN_SUCCESSFUL_EXIT;
  } else {
    napi_throw_range_error(env, NULL, "unknown handshake scenario");
    return NULL;
  }

  stage = STAGE_INITIAL;
  worker_owns_control_mutex = false;
  control_wait_calls = 0;
  control_mutex_destroy_calls = 0;
  control_cond_destroy_calls = 0;
  hook_dispatcher = NULL;
  uv_mutex_init(&stage_mutex);
  uv_cond_init(&stage_cond);
  uv_key_create(&worker_thread_key);
  uv_sem_init(&allow_enabled, 0);
  uv_sem_init(&stop_requested, 0);
  uv_sem_init(&worker_finished, 0);

  bool helper_started = false;
  if (scenario == TEST_SPURIOUS_WAKE) {
    helper_started = uv_thread_create(&helper_thread, spurious_helper, NULL) == 0;
    if (!helper_started) {
      napi_throw_error(env, NULL, "failed to create spurious-wake helper");
      return NULL;
    }
  }

  int start_status = uiohook_worker_start(noop_dispatch);
  int result = start_status;
  if (scenario == TEST_SPURIOUS_WAKE && start_status == UIOHOOK_SUCCESS) {
    result = uiohook_worker_stop();
  }

  if (helper_started) {
    uv_thread_join(&helper_thread);
  }

  bool cleanup_valid = true;
  if (scenario == TEST_ENABLED_THEN_SUCCESSFUL_EXIT &&
      start_status != UIOHOOK_SUCCESS) {
    cleanup_valid = control_mutex_destroy_calls == 1 &&
                    control_cond_destroy_calls == 1;
  }

  uv_sem_destroy(&worker_finished);
  uv_sem_destroy(&stop_requested);
  uv_sem_destroy(&allow_enabled);
  uv_key_delete(&worker_thread_key);
  uv_cond_destroy(&stage_cond);
  uv_mutex_destroy(&stage_mutex);

  if (!cleanup_valid) {
    napi_throw_error(env, NULL,
                     "startup synchronization was not destroyed exactly once");
    return NULL;
  }

  napi_value js_result;
  napi_create_int32(env, result, &js_result);
  return js_result;
}

NAPI_MODULE_INIT() {
  napi_value run;
  napi_create_function(env, "run", NAPI_AUTO_LENGTH, run_scenario, NULL, &run);
  napi_set_named_property(env, exports, "run", run);
  return exports;
}
