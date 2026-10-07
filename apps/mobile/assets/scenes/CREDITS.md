# Background photos

Chosen by Chinmay (Oct 2, 2026). Full-size originals are kept locally in `originals/` (not in git).
The `.webp` files are the whole photos (not cropped), shrunk so the long side is at most
2048 px (Android halves anything bigger before drawing it), WebP quality 90. The app crops them
to each phone's real screen size at runtime (`fitScene` in `components/SceneBackdrop.tsx`).

| Scene | Original file | Source / license |
|---|---|---|
| dawn | dawn-sunrise-early-1080x1920-11172.jpg (pier at sunrise, 1080 x 1920) | to fill in |
| day | Day image.jpg (lone tree on a field, 3024 x 4032) | to fill in |
| dusk | Dusk image.jpeg (lamp post and bridge, 3485 x 5227) | to fill in |
| night | night image.jpg (Milky Way over a ridge, 2160 x 3840) | to fill in |

To swap one: put the new photo in `originals/`, save it as `<scene>.webp` the same way, and update
its entry in `SCENES` in `components/SceneBackdrop.tsx`: pixel size, and `focusX` / `focusY` (where the
subject is, as fractions of width and height). Aim for at least 1440 x 2560 source pixels so it stays
sharp on big screens.
