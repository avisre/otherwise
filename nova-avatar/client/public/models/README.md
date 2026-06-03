# VRM models

Drop a **license-cleared** `.vrm` here named `nova.vrm` and it loads on startup:

```
client/public/models/nova.vrm
```

Override the default path with `VITE_DEFAULT_MODEL_URL` (see `client/.env.example`).

`.vrm` / `.vrma` files are **git-ignored** by default (they're large and often
license-bound). Don't commit a model you don't have redistribution rights to.

## Getting a model

- **Your own VRoid Studio export** is the safest, zero-restriction option.
- Or any VRM whose license permits your use. Respect the embedded license meta.

If no model is present, the app still boots — it shows an empty state and you can
drag-and-drop a `.vrm` onto the canvas, or use the file picker / URL loader.
