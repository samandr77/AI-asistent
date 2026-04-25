# Store screenshots

Five screenshots per device class. Before submitting, designers replace
these with real app captures; until then, the `generate-placeholders.sh`
script below creates solid-color frames with text labels that clear the
store-console upload step.

## Required sizes

| Device class        | Size (px)    | Store       | Count |
|---------------------|--------------|-------------|-------|
| `ios-69`            | 1320 × 2868  | App Store   | 5     |
| `ios-65`            | 1284 × 2778  | App Store   | 5     |
| `ipad-13`           | 2064 × 2752  | App Store   | 5     |
| `android-phone`     | 1080 × 1920  | Google Play | 5     |
| `android-tablet`    | 1200 × 1920  | Google Play | 5     |

## Labels

Screenshots 1–5 illustrate the core flow:
1. HOME — Today Top-3
2. DUMP — Voice recording
3. RESULT — Parsed tasks with priorities
4. GOALS — Goal with linked tasks
5. PAYWALL — Premium benefits

## Generating placeholders

Requires ImageMagick (`brew install imagemagick`). Run from this directory:

```bash
./generate-placeholders.sh
```

The script drops five `shot-N.png` files into each device-class folder.
