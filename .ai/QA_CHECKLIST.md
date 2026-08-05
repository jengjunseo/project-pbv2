# PBV3 QA

- [ ] Home accepts 0 and 99; rejects 100 and non-numeric input.
- [ ] Empty slot renders immediately and can save text.
- [ ] Reloading preserves data indefinitely (no TTL).
- [ ] Another device/browser can open the same slot.
- [ ] Text-only save does not touch Blob.
- [ ] File upload works under configured max size.
- [ ] Replacing/removing a file deletes the old Blob best-effort.
- [ ] Clear removes slot, order member, usage bytes, and Blob best-effort.
- [ ] Soft-cap pressure evicts oldest-updated slots, never the just-saved slot.
- [ ] Focus refresh does not overwrite unsaved local edits.
- [ ] Ctrl/Cmd+S saves.
- [ ] Mobile sticky save bar works.
- [ ] `npm run typecheck`, `npm run test`, `npm run lint`, `npm run build` pass.
