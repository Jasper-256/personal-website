# Infinity icosahedron optimization

- Improve performance during actual dragging, rotation, and zoom. Do not count stationary-frame caching as a movement speedup.
- Preserve the existing minimum 2× rendering resolution, reflection depth, and effects. Small numerical differences are acceptable if the result does not visibly look worse.
- Verify visual quality across multiple zoom levels, orientations, and viewport sizes; avoid optimizations that only work for the benchmark scene.
- Compare baseline and candidate on identical hardware, rendering settings, and moving camera paths. Repeat measurements to distinguish real gains from noise. Do not present GPU throughput as displayed FPS.
- Report startup and memory costs alongside performance gains.
