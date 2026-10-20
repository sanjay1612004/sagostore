# Shri Sai Ganesh Stores logo

`source-logo.png` is the user's unmodified Ganesha Lotus Gold Emblem. `store-logo.png` is the selected transparent PNG used by every in-app `StoreIcon`, including headers and startup. The white background and interior white negative space were removed using the built-in imagegen tool; there is no colored tile or rounded clipping in the in-app component.

Native launcher assets derive from this transparent master: `icon.png` is a 1024-pixel opaque charcoal canvas for platform compatibility; `adaptive-icon.png` has a transparent background with the emblem inside Android's safe region; `favicon.png` is a transparent 64-pixel browser icon. Canvas rendering only sizes and packages these assets; it does not perform background extraction or redesign the artwork.

The original image remains intact. The former storefront SVG has been replaced by this supplied emblem.

## Background-removal prompts

Mode: built-in imagegen; use case: background-extraction.

First prompt:

> Edit the attached existing Shri Sai Ganesh Stores Ganesha lotus gold emblem. Remove the white/near-white background and export the exact emblem on a genuinely transparent alpha background. Preserve the source design, proportions, smooth gold gradients and gold highlights, orange Ganesha ears and trunk, dark green arch and shopping bag, complete gold circular outer ring, complete lotus and all fine details. Remove white negative space both outside AND inside the circular ring and architectural arch, between lotus petals, and between the stylized Ganesha features: these white regions are negative-space background, not a filled white face. Do not redesign, reinterpret, add lettering, recolor, crop off the ring or lotus, add shadows, add a colored tile or draw a checkerboard. Keep the emblem centered on a square canvas with a small even transparent margin. This is precise background removal for a production app logo, not a new logo design.

Selected cleanup prompt (original and first cutout provided as references):

> Fix only the cutout quality: eliminate floating yellow/red/orange flecks, speckled pixels, detached dust, jagged colored fringe and scattered fragments outside the actual emblem or in its empty negative space, particularly above the outer gold ring, around the ring, around Ganesha's eyes and trunk, and below the lotus tip. Make these empty areas completely alpha=0. Preserve the exact real artwork from the original: smooth continuous gold ring and gold highlights, emerald arch, orange ears and trunk, gold eyes, green shopping bag and entire lotus. Do not redraw or stylize the logo. Remove all white background inside and outside the emblem, including the white face negative space. Smooth antialiased edges with no white halo. No color spill, no glow, no added shadow, no fake transparency checkerboard and no colored backdrop. Output a pristine centered square transparent PNG with the complete emblem and a little transparent margin.
