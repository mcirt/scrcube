# Custom 3D Boggle Solver v4.3 — hardwired diagnostic/fix

This build makes the two failing controls independent of normal app initialization.

- Every starting input has a direct inline `oninput="v43Advance(this)"`.
- Auto-advance uses the visual order:
  3,2,6,1,5,9,4,8,7, then 10-27.
- Start Cube has a direct inline `onclick="v43Start()"`.
- A visible engine-status line reports:
  - `Starting-entry JavaScript: ACTIVE`
  - then `Cube engine: READY`
  - or an explicit JavaScript error if the cube engine failed.

This build also keeps the exact simple v1 input listener as a fallback.
