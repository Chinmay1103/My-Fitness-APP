# Background photos

Chosen by Chinmay (Oct 2, 2026). Full-size originals are kept locally in `originals/` (not in git).
The `.webp` files are converted copies: trimmed to a 1:2 portrait, at most 3300 px tall, WebP
quality 80.

| Scene | Original file | Source / license |
|---|---|---|
| dawn | dawn-sunrise-early-1080x1920-11172.jpg (pier at sunrise, 1080 x 1920) | to fill in |
| day | Day image.jpg (lone tree on a field, 3024 x 4032) | to fill in |
| dusk | Dusk image.jpeg (lamp post and bridge, 3485 x 5227) | to fill in |
| night | night image.jpg (Milky Way over a ridge, 2160 x 3840) | to fill in |

To swap one: put the new photo in `originals/`, convert it to `<scene>.webp` (portrait, ideally
3300 px tall), and adjust its `FOCUS` value in `components/SceneBackdrop.tsx`.
