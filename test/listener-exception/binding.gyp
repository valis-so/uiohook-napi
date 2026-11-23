{
  "targets": [
    {
      "target_name": "listener_exception_test",
      "sources": [
        "listener_exception_addon.c",
        "../../src/lib/napi_helpers.c"
      ],
      "include_dirs": [
        "../../src/lib"
      ]
    },
    {
      "target_name": "late_event_test",
      "sources": [
        "late_event_addon.c",
        "../../src/lib/napi_helpers.c"
      ],
      "include_dirs": [
        "../../libuiohook/include",
        "../../src/lib"
      ],
      "conditions": [
        ["OS!='win'", {
          "cflags": ["-std=c11"]
        }],
        ["OS=='mac'", {
          "xcode_settings": {
            "GCC_C_LANGUAGE_STANDARD": "c11"
          }
        }]
      ]
    }
  ]
}
