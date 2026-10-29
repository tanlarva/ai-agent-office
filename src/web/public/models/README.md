# Local anime cast

Downloaded character files belong in `local/` and are deliberately ignored by Git.
This app runs on the owner's loopback server; these files must not be published with the source or a public build.

| File | Character | Original source / author |
| --- | --- | --- |
| local/yori.vrm | Orchestrator: Yori | https://booth.pm/ja/items/3721509, 躑躅屋 / 有島リツ |
| local/amane-1.vrm | Member 1: Amane Type01 | https://booth.pm/ja/items/4911831, yousoron-shop |
| local/amane-2.vrm | Member 2: Amane Type02 | Same source |
| local/amane-3.vrm | Member 3: Amane Type03 | Same source |
| local/amane-4.vrm | Member 4: Amane Type04 | Same source |

Use the clothed Type01–04 files, not the `sotai` base-body variants.
Download from the authors using your BOOTH account. Extract Yori's VRM from the ZIP, then rename files as above.
Build again after adding files (`npm run build`) and reload the app. Vite copies public assets to dist/web/models.
Missing or invalid files show a visible fallback notice and the original robots.

Yori's current VN3 terms allow personal use and modification; original/modified redistribution needs the author's involvement.
Full author-linked license: https://drive.google.com/file/d/1WrwM1M11uYuu25zZMmCEyqHqCAfvLbkv/view
The Japanese original prevails: https://drive.google.com/file/d/1xNSbElwXFG19A_hM_3noqxJAq56E6Sb-/view
Amane's product page allows modification and commercial use, prohibits resale, and makes attribution optional.
Keep the original licenses beside your downloads. Do not include signed download URLs or authentication data in source/logs.
