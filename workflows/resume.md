# FreeSurfer Workflow: Resume from Failure

This workflow handles cases where a recon-all run was interrupted —
crash, system shutdown, manual cancellation, or step-specific error.
The goal is to determine where it stopped and continue from there.

**FreeSurfer version:** 7.x

---

## Diagnosis: where did it stop?

The first action is always to check the status log:

```bash
tail -20 $SUBJECTS_DIR/$SUBJECT/scripts/recon-all-status.log
```

This log shows high-level progress. It will end with one of:
- `<step name> finished without error at <timestamp>` (clean stop —
  unusual; means full pipeline finished but agent didn't realize)
- `<step name> finished with ERRORS at <timestamp>` (error stop)
- No "finished" line on the last entry (mid-step interruption)

Also check the full log for error details:
```bash
tail -50 $SUBJECTS_DIR/$SUBJECT/scripts/recon-all.log
```

---

## Three resume scenarios

### Scenario A: Clean interruption (no error)

The pipeline was interrupted (Ctrl-C, system reboot, etc.) but no
specific step crashed. recon-all-status.log shows the last step
completed; the next step never started.

**Resume command:**
```bash
recon-all -s $SUBJECT -make all
```

`-make all` reads recon-all-status.log, finds the next unstarted step,
and continues from there. This is the safest, most automatic resume.

### Scenario B: Step-specific crash with clear error

A step crashed (segfault, missing file, bad input). The error message
in recon-all.log identifies the failing command.

**Procedure:**

1. **Identify the failing step** from the error message
2. **Diagnose the cause:**
   - Disk space full → free space, then resume
   - Permission error → fix permissions
   - Missing atlas file → check `$FREESURFER_HOME/average/` integrity
   - OOM (out of memory) → reduce parallelism or increase swap
   - Bad input data → may need to fix upstream or reject subject
3. **Fix the cause**
4. **Resume:**
   ```bash
   recon-all -s $SUBJECT -make all
   ```

If `-make all` doesn't work (e.g., it tries to skip the failed step
because a partial output exists), force-redo the specific step:

```bash
# Delete the partial output, then re-run
rm $SUBJECTS_DIR/$SUBJECT/<partial-output-file>
recon-all -s $SUBJECT -<failed-step-flag>
recon-all -s $SUBJECT -make all
```

### Scenario C: Step finished but result is wrong

Pipeline didn't crash, but a QC node revealed a bad result. The fix is
not "resume" but "edit + re-run." See:

- QC1 fail → `editing/brainmask_edit.md`
- QC2 fail → `editing/wm_edit.md`
- QC3 fail → usually back to `editing/wm_edit.md`
- QC4 fail → `editing/surface_edit.md` or back to brainmask

This is not a resume scenario; this is an editing scenario covered by
the QC protocol.

---

## Common error patterns and fixes

### "Topology fixer failed" / many defects after step 20

```
ERROR: too many defects (>1000)
```

Cause: usually wm.mgz is severely wrong, leading to a broken surface.

Fix:
1. Go back to QC2; review `wm.mgz`
2. Edit wm.mgz (see `editing/wm_edit.md`)
3. Re-run from `-autorecon2-wm`

### "Talairach failed" / `talairach_avi` error

```
ERROR: talairach_avi failed
```

Cause: the input T1 is too far from the MNI305 atlas to register
linearly (e.g., severely cropped FOV, very different orientation).

Fix:
1. Verify input T1: `freeview $SUBJECTS_DIR/$SUBJECT/mri/orig.mgz`
2. If FOV is cropped → re-acquire or use `mri_robust_register` with
   a more permissive initial alignment
3. If orientation is unusual → check `mri_info` output and reorient
4. Re-run: `recon-all -s $SUBJECT -clean-tal -autorecon1`

### "Skull stripping failed" / brainmask is empty or whole volume

Cause: `mri_watershed` gradient seeded incorrectly, often due to
extreme bias field or unusual contrast.

Fix:
1. Try with `-3T` flag if 3T data:
   ```bash
   recon-all -s $SUBJECT -clean-bm -3T -skullstrip
   ```
2. Or substitute SynthStrip:
   ```bash
   mri_synthstrip -i $SUBJECTS_DIR/$SUBJECT/mri/T1.mgz \
     -o $SUBJECTS_DIR/$SUBJECT/mri/brainmask.mgz
   recon-all -s $SUBJECT -autorecon2 -autorecon3
   ```

### "CA register out of memory" / step 8 crash with OOM

Cause: insufficient RAM for the nonlinear registration.

Fix:
1. Reduce parallelism: drop `-openmp` count
2. Close other memory-heavy processes
3. Resume:
   ```bash
   recon-all -s $SUBJECT -make all
   ```

### "Segmentation fault" without obvious cause

Cause: usually corrupted intermediate file or filesystem issue.

Fix:
1. Check filesystem: `df -h $SUBJECTS_DIR`
2. Check the last-modified file in the subject dir
3. If file is corrupted, delete and re-run that step
4. If recurring, may need to start from scratch:
   ```bash
   rm -rf $SUBJECTS_DIR/$SUBJECT
   recon-all -s $SUBJECT -i T1.nii.gz -all
   ```

---

## Determining "where" without -make all

If you want explicit control instead of `-make all`:

```bash
# Inspect status log to find last completed step
tail -10 $SUBJECTS_DIR/$SUBJECT/scripts/recon-all-status.log

# Map the step to a flag using reference/all_31_steps.md
# Then run from the next step manually
recon-all -s $SUBJECT -<next-step-flag>
recon-all -s $SUBJECT -<step-after-that-flag>
# ... etc

# Or chain stage flags to cover the remainder:
recon-all -s $SUBJECT -autorecon3   # if last completed was autorecon2
```

This is more cumbersome than `-make all` but gives explicit visibility.

---

## When resume isn't possible

Some failures can't be resumed cleanly:

- **Partial corruption of an early file** (e.g., orig.mgz damaged) →
  start from scratch
- **Atlas file missing or corrupted** → re-install FreeSurfer or copy
  fresh atlases
- **Disk space ran out mid-step and partial files exist** → delete
  partial files, then resume
- **Hardware failure during write** → check filesystem, may need to
  start over

When in doubt, the nuclear option is:
```bash
rm -rf $SUBJECTS_DIR/$SUBJECT
recon-all -s $SUBJECT -i original_T1.nii.gz -all
```

This loses all progress but guarantees a clean state.

---

## After successful resume

Once the resume completes, the agent should:

1. Verify final outputs exist (same checks as `workflows/default.md`
   step 10)
2. If QC nodes were skipped during the resume, run the snapshots
   retrospectively for the user to spot-check
3. Note in the QC log that this run was a resume:
   ```bash
   echo "$(date -Iseconds) Resumed after <error>; final state OK" \
     >> $QC_DIR/qc_log.txt
   ```

---

## Diagnostic command cheat sheet

```bash
# Where did it stop?
tail -20 $SUBJECTS_DIR/$SUBJECT/scripts/recon-all-status.log

# What was the error?
tail -50 $SUBJECTS_DIR/$SUBJECT/scripts/recon-all.log
grep -i error $SUBJECTS_DIR/$SUBJECT/scripts/recon-all.log | tail -10

# What files exist? (compare against expected outputs)
find $SUBJECTS_DIR/$SUBJECT -name "*.mgz" -newer some_reference_file

# Check disk space
df -h $SUBJECTS_DIR

# Check for the lock file (recon-all may refuse to run if it thinks
# another instance is running)
ls -la $SUBJECTS_DIR/$SUBJECT/scripts/IsRunning.*
# If a stale lock exists from a crashed run:
rm $SUBJECTS_DIR/$SUBJECT/scripts/IsRunning.*
# OR pass -no-isrunning to recon-all
```

---

## Resume command cheat sheet

| Situation | Command |
|---|---|
| Clean interrupt, no error | `recon-all -s $SUBJECT -make all` |
| Stale lock from crash | Add `-no-isrunning` to any command |
| Force redo a specific step | `recon-all -s $SUBJECT -clean-<thing> -<step-flag>` |
| Resume from a known stage | `recon-all -s $SUBJECT -autorecon<N>` |
| Last resort: start over | `rm -rf $SUBJECTS_DIR/$SUBJECT; recon-all -s $SUBJECT -i T1.nii.gz -all` |
