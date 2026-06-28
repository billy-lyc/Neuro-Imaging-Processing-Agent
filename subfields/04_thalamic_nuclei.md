# Tool 4: segmentThalamicNuclei.sh

Segment thalamus into 25 nuclei per hemisphere using T1.

**Generation:** Classic shell wrapper (Gen 1)

**Atlas:** Iglesias et al. 2018 (thalamic nuclei)

**Runtime:** 1-2 hours per subject

---

## Prerequisites

- `recon-all -all` completed
- `$SUBJECTS_DIR/<subject>/mri/aseg.mgz` exists
- `$SUBJECTS_DIR/<subject>/mri/norm.mgz` exists

---

## Command

```bash
export SUBJECTS_DIR=/path/to/subjects
source $FREESURFER_HOME/SetUpFreeSurfer.sh

segmentThalamicNuclei.sh $SUBJECT
```

Optional SUBJECTS_DIR override as second argument.

---

## Outputs

### Segmentation volume (in `mri/`)
- `ThalamicNuclei.v13.T1.mgz` — single volume with both hemispheres

(Left labels are 8000-series, right labels are 8100-series.)

### Stats files (in `stats/`)
- `thalamic-nuclei.lh.v13.T1.stats` — left thalamus volumes
- `thalamic-nuclei.rh.v13.T1.stats` — right thalamus volumes

---

## Thalamic nuclei (25 per hemisphere)

Grouped by classical functional groups:

### Anterior group
| Label | Structure | Function |
|---|---|---|
| AV | Anteroventral | Limbic, memory |

### Lateral group
| Label | Structure | Function |
|---|---|---|
| LD | Laterodorsal | Limbic |
| LP | Lateral posterior | Visuospatial |

### Ventral group
| Label | Structure | Function |
|---|---|---|
| VA | Ventral anterior | Motor (basal ganglia output) |
| VAmc | Ventral anterior magnocellular | |
| VLa | Ventral lateral anterior | Motor |
| VLp | Ventral lateral posterior | Motor (cerebellar output) |
| VPL | Ventral posterolateral | Somatosensory |
| VM | Ventromedial | |

### Intralaminar group
| Label | Structure |
|---|---|
| CeM | Central medial |
| CL | Central lateral |
| Pc | Paracentral |
| CM | Centromedian |
| Pf | Parafascicular |

### Medial group
| Label | Structure | Function |
|---|---|---|
| MV-Re | Medioventral / Reuniens | Limbic |
| MDl | Mediodorsal lateral | Prefrontal connectivity |
| MDm | Mediodorsal medial | Prefrontal connectivity |

### Posterior group
| Label | Structure | Function |
|---|---|---|
| LGN | Lateral geniculate | Vision |
| MGN | Medial geniculate | Audition |
| L-Sg | Limitans/suprageniculate | |
| PuA | Pulvinar anterior | Higher visual |
| PuI | Pulvinar inferior | |
| PuL | Pulvinar lateral | |
| PuM | Pulvinar medial | |

Plus:
- Whole_thalamus — total of all nuclei (per hemisphere)

---

## Typical volumes (healthy adults, mm³)

| Structure | Per hemisphere |
|---|---|
| Whole_thalamus | 6000-8500 |
| MDm | 200-400 |
| Pulvinar (sum) | 1500-2200 |
| LGN | 80-200 |
| MGN | 30-100 |

The smallest nuclei (LGN, MGN, Pf) are at the limit of resolvability
on standard 1mm T1; their volumes are noisier than larger nuclei.

---

## QC

### Numerical
```bash
cat $SUBJECTS_DIR/$SUBJECT/stats/thalamic-nuclei.lh.v13.T1.stats
cat $SUBJECTS_DIR/$SUBJECT/stats/thalamic-nuclei.rh.v13.T1.stats
```

Check that Whole_thalamus values are roughly symmetric (within ~10%)
and within typical range.

### Visual

```bash
freeview -v $SUBJECTS_DIR/$SUBJECT/mri/T1.mgz \
  $SUBJECTS_DIR/$SUBJECT/mri/ThalamicNuclei.v13.T1.mgz:colormap=lut:opacity=0.5 \
  -viewport axial \
  -ss $QC_DIR/qc_thalamus_axial.png 2 -quit

freeview -v $SUBJECTS_DIR/$SUBJECT/mri/T1.mgz \
  $SUBJECTS_DIR/$SUBJECT/mri/ThalamicNuclei.v13.T1.mgz:colormap=lut:opacity=0.5 \
  -viewport coronal \
  -ss $QC_DIR/qc_thalamus_coronal.png 2 -quit
```

Check (axial view):
- Both thalami fully covered
- Internal nuclear boundaries follow general medial-lateral and
  anterior-posterior gradients
- Pulvinar (posterior) clearly distinct from MD (medial)
- LGN visible as a distinct posterolateral structure

---

## Common issues

**"Some small nuclei have zero volume"**
- LGN, MGN, Pf, AV are sometimes too small to segment confidently
  on 1mm T1
- Usually acceptable if the larger nuclei look reasonable
- For nucleus-specific studies, consider higher-resolution T1
  (0.7mm or 0.5mm)

**"Volumes asymmetric beyond expected"**
- More than ~15% asymmetry in Whole_thalamus suggests segmentation
  issue or genuine pathology
- Check aseg.mgz thalamus labeling — input quality drives this output

**"Nuclei boundaries look noisy/jagged"**
- Expected at 1mm resolution; the algorithm trades spatial precision
  for label confidence
- Use volumes (not voxel-precise boundaries) for analysis

---

## Aggregate stats extraction

```bash
asegstats2table --subjects $(cat subjects.txt) \
  --statsfile=thalamic-nuclei.lh.v13.T1.stats \
  --tablefile=lh_thalamic_nuclei.tsv \
  --skip

asegstats2table --subjects $(cat subjects.txt) \
  --statsfile=thalamic-nuclei.rh.v13.T1.stats \
  --tablefile=rh_thalamic_nuclei.tsv \
  --skip
```

---

## Research applications

- **Movement disorders:** VLp (cerebellar input), VLa (basal ganglia
  input) atrophy in dystonia, tremor disorders
- **Psychiatric disorders:** MD nuclei changes in schizophrenia
- **Sensory disorders:** LGN/MGN volume changes
- **Consciousness research:** intralaminar nuclei
- **Pain/somatosensory:** VPL, VPM (VPM not separately segmented in
  this atlas)

---

## Notes

**Atlas version `v13`:** Current default. Note that `v10` was an
earlier version with slightly different boundaries.

**`.T1` in filename:** Indicates T1-only segmentation. There's no
T2-enhanced version of thalamic segmentation in standard FreeSurfer.

**Equivalent in new interface:** Tool #5 (`segment_subregions
thalamus`) produces equivalent output.
