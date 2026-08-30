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
    }
  ]
}
