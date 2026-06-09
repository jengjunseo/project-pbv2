# QA Checklist

- [ ] Save and read slot 0.
- [ ] Save and read slot 99.
- [ ] Reject slot 100.
- [ ] Reject slot -1.
- [ ] Reject non-numeric slot input.
- [ ] Save text and read it from another browser.
- [ ] Confirm 10 minute TTL is set.
- [ ] Confirm clear button removes Redis data.
- [ ] Upload a file smaller than 5MB.
- [ ] Reject a file larger than 5MB.
- [ ] Reject blocked extensions.
- [ ] Confirm file names are sanitized in Blob paths.
- [ ] Confirm production build succeeds.

## Manual Review Notes
- GitHub repository was confirmed public and empty.
- Dependency installation and runtime checks require npm or another package manager in the execution environment.
