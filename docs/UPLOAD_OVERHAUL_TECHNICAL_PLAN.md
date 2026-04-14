# Upload Section Overhaul — Technical Plan

## 1. Overview

Replace the current **tab-based** Upload flow (Track vs Album) with a **single, unified flow** driven by a single dropzone. Mode (Single Track vs Album) is derived from the number of files dropped. The UI follows a **SlothUI-style** layout: clean white/light-gray containers, rounded corners, and a sidebar-focused two-column layout.

---

## 2. Unified Dropzone & onDrop Logic

### 2.1 Accept Criteria

- **Accepted types:** `.mp3` (audio/mpeg) and `.wav` (audio/wav).
- **Input:** `accept=".mp3,.wav,audio/mpeg,audio/wav"` and validate in code by `file.type` and/or extension.
- **Multiple files:** Allow `multiple` on the file input and handle `FileList` in both drag-and-drop and click-to-browse.

### 2.2 onDrop Event Flow

```
onDrop(files: FileList | null) / onFilesSelected(files: File[])
  │
  ├─ Filter: keep only .mp3 and .wav (by type or extension).
  ├─ If filtered.length === 0 → show error toast/message, return.
  │
  ├─ If filtered.length === 1:
  │     setUploadMode('single')
  │     setTracks([{ file, title: '', duration: 0, order: 1 }])
  │     setAlbumTitle('')  // unused but keep for consistency
  │     → Render Single Track form (title, artist, album, genre, cover, etc.)
  │
  └─ If filtered.length > 1:
        setUploadMode('album')
        setAlbumTitle('')  // user fills in
        setTracks(filtered.map((file, i) => ({
          file,
          title: file.name.replace(/\.[^.]+$/, '') || `Track ${i + 1}`,
          duration: 0,  // resolve async via getAudioDuration
          order: i + 1
        })))
        → Resolve durations in parallel (getAudioDuration per file).
        → Render Album form (album title, shared artist/genre, sortable track list).
```

### 2.3 Differentiating Single vs Bulk

| Dropped count | Mode        | State set                    | Form shown                          |
|---------------|-------------|-----------------------------|-------------------------------------|
| 0 (invalid)   | —           | Error message               | —                                   |
| 1             | `'single'`  | `tracks = [one]`            | Single Track fields + one cover     |
| 2+            | `'album'`   | `tracks = [...], albumTitle`| Album Title + shared fields + list  |

- **Single source of truth:** One `tracks` array. Single = `tracks.length === 1`, Album = `tracks.length > 1`.
- Optional derived: `uploadMode: 'single' | 'album' = tracks.length > 1 ? 'album' : 'single'` (or store explicitly for clarity and to avoid flicker when removing tracks).

### 2.4 Re-drops and Replacements

- **Replace all:** On new drop when `tracks.length > 0`, either:
  - **Option A:** Replace entire list (clear, then apply same 1 vs >1 logic), or
  - **Option B:** Show confirmation “Replace current upload?” then replace.
- **Add more (Album only):** Optional “Add more files” in dropzone that appends to `tracks` and keeps mode `'album'` (with a max, e.g. 20).
- **Remove last track in Single:** Clearing the single track should clear the form and show empty dropzone again (reset to initial state).

---

## 3. State Management

### 3.1 Unified State Shape

```ts
type UploadMode = 'single' | 'album';

interface TrackEntry {
  id: string;           // uuid or temp id for list keys / DnD
  file: File;
  title: string;
  duration: number;     // seconds, from getAudioDuration
  order: number;
}

interface UploadState {
  mode: UploadMode;
  tracks: TrackEntry[];
  albumTitle: string;
  // Shared metadata (for single: used as-is; for album: shared defaults)
  artist: string;
  genre: string;
  coverImage: File | null;
  // Single-only (or album-level optional)
  albumName?: string;
  price?: string;
  sellInStore: boolean;
  storePrice: string;
  storeCategory: string;
  storeTags: string[];
}
```

- **Single:** `tracks.length === 1`, form shows one “Track title” (maps to `tracks[0].title`), plus artist, album, genre, cover.
- **Album:** `tracks.length > 1`, form shows “Album title” (`albumTitle`), shared artist/genre, one cover, then **sortable list** of `tracks` (each row: order, title editable, duration, remove).

### 3.2 Transition from Current Tabs

- **Remove:** `activeTab: 'music' | 'album'` and the Track/Album tab UI.
- **Remove:** Separate `MusicUpload` and `AlbumUpload` components as distinct entry points.
- **Introduce:** One `UnifiedUpload` (or single `Upload` page) that:
  - Renders one dropzone.
  - When `tracks.length === 0`: only dropzone + short instructions.
  - When `tracks.length === 1`: dropzone (optional “replace”) + Single Track form.
  - When `tracks.length > 1`: dropzone (optional “add more” / “replace”) + Album form (album title + sortable list + shared fields).
- Reuse existing **submit logic**: single track → current “track insert” flow; album → current “album + multiple track upload” flow, with `tracks` order preserved.

---

## 4. Drag-and-Drop Sortable List (Multiple Tracks)

### 4.1 Requirements

- Only visible when `tracks.length > 1` (Album mode).
- Each row: drag handle, order #, editable title, duration, remove.
- Reorder by drag; on drop, update `order` and sort `tracks` so state stays in sync (e.g. `setTracks(reordered)` with new `order` values 1..n).

### 4.2 Library Choice

| Option | Pros | Cons |
|--------|------|------|
| **@dnd-kit/core + @dnd-kit/sortable** | Accessibility, flexible, good for sortable lists | New dependency |
| **framer-motion Reorder** | Already in project, simple API | Less built-in a11y; sufficient for reorder list |

**Recommendation:** Use **framer-motion** `Reorder` to avoid new deps and keep the list simple. If we later need full keyboard/screen-reader sortable, add `@dnd-kit/sortable`.

### 4.3 Framer-Motion Reorder (Proposed)

- Wrap list in `<Reorder.Group axis="y" values={tracks} onReorder={setTracks}>`.
- Each item: `<Reorder.Item value={item} id={item.id}>` with drag handle.
- `tracks` state is the source of truth; after reorder, reassign `order` 1..n from index.
- List item content: handle icon, `order`, input for `title`, `formatDuration(duration)`, remove button.

### 4.4 dnd-kit Alternative (If Added Later)

- `DndContext`, `SortableContext` with `strategy: verticalListSortingStrategy`.
- Each row: `useSortable` + `SortableContext`; drag handle and `attributes`/`listeners` on handle.
- On `DragEndEvent`, reorder array and update `order` fields.

---

## 5. Visual Style (SlothUI Aesthetic)

### 5.1 Layout

- **Page:** Breadcrumbs (e.g. Home > Upload), then title + subtitle.
- **Two-column layout (e.g. lg):**
  - **Left (sidebar-like):** Single large dropzone. Full height or min-height so it’s the main “drop here” area. Optional: after files loaded, compact dropzone + “Add more” or “Replace” for album.
  - **Right:** Form panel(s) in a scrollable column:
    - **Single:** Track title, artist, album, genre, cover thumbnail strip, optional store/copyright toggles.
    - **Album:** Album title, artist, genre, cover, then sortable track list, then optional toggles.
- **Single column (mobile):** Stack dropzone above form.

### 5.2 SlothUI Look & Feel

- **Containers:** White or very light gray (`bg-white`, `bg-gray-50`), rounded corners (`rounded-xl` / `rounded-2xl`), subtle border (`border border-gray-200`).
- **Dropzone:** Large rounded area, dashed border (e.g. `border-2 border-dashed`), accent color (e.g. purple/violet) on border and “Select file” button; cloud/upload icon; supporting text “Supported: MP3, WAV (max X MB)”.
- **Form inputs:** Light gray background, rounded, clear labels; character counters where needed (e.g. title 50 chars).
- **Sortable list:** Each row in a light card or list item; drag handle (grip icon) on the left; spacing between rows.
- **Buttons:** Primary = accent (e.g. purple/violet); secondary = gray outline.
- **No dark-mode-heavy blocks:** Prefer light surfaces so the upload page feels “SlothUI” even if the rest of the app is dark (optional: wrap in a light-themed section or page-level class).

### 5.3 Class Conventions (Tailwind)

- Page/section: `bg-gray-50` or `bg-white`, `rounded-2xl`, `shadow-sm`, `border border-gray-200`.
- Dropzone: `border-2 border-dashed border-violet-300`, `bg-violet-50/50`, hover `border-violet-500`, button `bg-violet-600 text-white`.
- Inputs: `bg-gray-50 border border-gray-200 rounded-xl px-4 py-3`.
- Labels: `text-sm font-medium text-gray-700`.

---

## 6. File Validation & Errors

- **onDrop:** Filter to `.mp3`/`.wav` only; if any file is invalid, show message: “Only MP3 and WAV files are supported.”
- **Size:** Enforce max file size (e.g. 50 MB per file) before adding to `tracks`; show which file(s) exceeded the limit.
- **Count:** Album max (e.g. 20 tracks); on drop, if current + new > max, either cap and notify or reject and show message.

---

## 7. Submit Flow (Unchanged Behavior)

- **Single:** Same as current MusicUpload: copyright check → upload audio + cover → insert one row into `tracks` table → clear form / reset to empty dropzone.
- **Album:** Same as current AlbumUpload: create album (if applicable), upload cover once, upload each track in `tracks` order, create playlist/album and attach tracks, then clear form.
- **Copyright:** Run per-track (or per-first-track for album, depending on product decision); use existing `checkCopyright` before starting upload.

---

## 8. Implementation Order

1. **State & types:** Introduce `UploadMode`, `TrackEntry`, and unified `UploadState`; remove tab state.
2. **Unified dropzone:** One zone, accept multiple .mp3/.wav; onDrop/onChange normalize to `File[]`, then apply “1 vs >1” logic and set `tracks` + `mode`/`albumTitle`.
3. **Single-track form:** When `tracks.length === 1`, render existing single-track fields (title, artist, album, genre, cover) bound to shared state + `tracks[0].title`.
4. **Album form:** When `tracks.length > 1`, render album title, shared artist/genre/cover, then sortable list.
5. **Sortable list:** Implement with framer-motion `Reorder` (or dnd-kit); update `order` and state on reorder.
6. **Styling pass:** Apply SlothUI-style classes (light containers, rounded, accent border/buttons, two-column layout).
7. **Edge cases:** Replace-all vs add-more, remove last track (reset to empty), validation messages, max count/size.
8. **Cleanup:** Remove `MusicUpload`/`AlbumUpload` tabs and unused tab UI; keep one `Upload` page with the unified flow.

---

## 9. Summary

| Area | Approach |
|------|----------|
| **onDrop** | Accept .mp3/.wav only; 1 file → single mode, >1 → album mode; populate `tracks` and optional `albumTitle`. |
| **State** | Single `tracks` array + `albumTitle` + shared metadata; mode derived or stored. |
| **UI** | One dropzone (left), one form (right); form switches by `tracks.length`. |
| **Sortable list** | Framer-motion `Reorder` for album track order; update `order` from index. |
| **Visual** | SlothUI: white/light-gray, rounded, accent borders/buttons, two-column layout. |

This plan keeps existing upload and backend behavior while unifying the experience and making single vs bulk a result of how many files the user drops.
