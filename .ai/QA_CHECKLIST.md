# PBV3 QA

- [ ] Home accepts 0 and 99; rejects 100 and non-numeric input.
- [ ] Empty slot renders immediately and can save text.
- [ ] Reloading the slot preserves data indefinitely (no TTL).
- [ ] Another device/browser can open the same slot.
- [ ] Text-only save does not touch Blob.
- [ ] File upload works under configured max size.
- [ ] Replacing a file removes the previous Blob best-effort.
- [ ] Removing a file then saving keeps text and deletes the old Blob.
- [ ] Clear removes Redis slot, order member, usage bytes, and Blob best-effort.
- [ ] Soft-cap pressure evicts oldest-updated slots, never the just-saved slot.
- [ ] Focus refresh does not overwrite unsaved local edits.
- [ ] Ctrl/Cmd+S saves.
- [ ] Mobile sticky save bar works.
- [ ] `npm run typecheck`, `npm run test`, `npm run lint`, `npm run build` all pass.
