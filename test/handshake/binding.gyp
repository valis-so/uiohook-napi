{
  "targets": [
    {
      "target_name": "handshake_test",
      "sources": ["handshake_addon.c"],
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
    },
    {
      "target_name": "cleanup_failure_test",
      "sources": [
        "cleanup_failure_addon.c",
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
