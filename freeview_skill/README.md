# FreeView Online

A web-based neuroimaging viewer and annotation editor, built on top of [FreeView](https://surfer.nmr.mgh.harvard.edu/fswiki/FreeviewGuide/FreeviewIntroduction) and [NiiVue](https://github.com/niivue/niivue).

Supports loading NIfTI (`.nii`, `.nii.gz`) and FreeSurfer (`.mgz`, `.mgh`) volumes directly in the browser — no installation required.

---

## Drawing Modes

Click **Create Drawing Layer** in the Scene Details tab to start annotating. Three editing modes are available:

### Voxel Edit (general)

Free-form voxel annotation. Assign any pen value from 1 to 255. Use labels to organize structures by name, value, and color. The result is saved as a new overlay volume (`.nii.gz`).

Best for: general-purpose manual segmentation.

### Recon Edit (FreeSurfer)

Follows FreeSurfer convention: pen value 255 adds tissue, pen value 1 removes it. Edits are written back directly to the selected reference volume on save — the original file is modified in place.

Best for: correcting FreeSurfer `recon-all` outputs such as `wm.mgz` or `brainmask.mgz`.

### ROI Edit (binary mask)

Binary mask mode. Pen value is fixed at 1. The result is saved as a new overlay volume (`.nii.gz`).

Best for: drawing regions of interest for further analysis.

---

### Switching modes with unsaved changes

If you switch between editing modes while there are unsaved strokes, a dialog will appear with three options:

- **Save & Switch** — save the current drawing, then switch mode
- **Discard** — discard the current drawing, then switch mode
- **Cancel** — stay in the current mode

---

## Running Locally

**Requirements:** [Node.js](https://nodejs.org) and npm.

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd freebrowse

# 2. Install dependencies
cd frontend
npm install

# 3. Start the development server
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Usage

1. Drag and drop image files onto the viewer, or use the **Scene Details** tab to load volumes.
2. Supported formats: `.nii`, `.nii.gz`, `.mgz`, `.mgh`, `.nvd`
3. To annotate a volume:
   - Click **Create Drawing Layer** to start from a blank canvas, or
   - Click the pencil icon next to a loaded volume to convert it into an editable drawing layer
4. Select a drawing mode, pick a draw mode (Pen or Magic Wand), and start annotating
5. Click **Save Drawing** (or **Save & Write Back** in Recon mode) when done

---

## Tech Stack

- [React](https://react.dev) + [TypeScript](https://www.typescriptlang.org)
- [Vite](https://vite.dev)
- [Tailwind CSS](https://tailwindcss.com) + [Radix UI](https://www.radix-ui.com)
- [NiiVue](https://github.com/niivue/niivue)
