# 🖼️ Drive View

Browse the images and videos you already keep in Google Drive, straight from the browser.
Sign in with Google, pick a folder, and get a fast thumbnail grid with a fullscreen
viewer — no backend, no server-side storage, nothing leaves your machine except the
Drive API calls Google already handles for you.

Live version: https://k1n91nth3n0rth.github.io/DriveView/

## Features

- **Google sign-in** via OAuth 2.0 (`@react-oauth/google`); the app requests the
  `drive` scope and talks to the Drive REST API directly from the browser.
- **Folder picker** listing your Drive folders, with large media/working trees
  (e.g. a ComfyUI install) collapsed down to just their `output` folder.
- **Thumbnail grid** for images and videos, with an adjustable column count.
- **Fullscreen viewer**: keyboard navigation (`←` / `→`), `Esc` to close, swipe on
  touch devices, and an `n / total` counter.
- **Preloading** of neighbouring items so next/previous feels instant.
- **Delete** (moves the file to Drive trash) and **copy to folder**.
- **Open in new tab** and **view as text** for the selected file.

## Installation

```bash
git clone https://github.com/k1n91nth3n0rth/DriveView.git
cd DriveView
npm install
npm start
```

Then open http://localhost:3000.

### Pointing it at your own Google project

The app ships with a working OAuth client id so it runs out of the box, but **forks
should use their own**:

1. Create an OAuth client of type *Web application* in the
   [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Enable the **Google Drive API** for that project.
3. Add every origin you serve the app from (e.g. `http://localhost:3000`,
   `https://<you>.github.io`) under *Authorised JavaScript origins*.
4. Copy `.env.example` to `.env.local` and set `REACT_APP_GOOGLE_CLIENT_ID`.

> A Google OAuth *client* id is not a secret — it is always shipped inside the JS
> bundle. The **client secret** is what must never appear in a browser app, and
> this project does not use one (implicit/popup token flow only).

## Usage

1. Click **Sign in with Google** and grant Drive access.
2. Pick a folder from the grid.
3. Click any thumbnail to open the fullscreen viewer.
   - `←` / `→` or swipe to move between files, `Esc` or the backdrop to close.
   - **Delete** trashes the file, **Copy to folder** copies it into the folder
     selected in the *Copy to* dropdown, **Open in new tab** opens the raw file,
     **View as text** shows the file's bytes as plain text (useful for the `.txt`
     prompt files some generation tools write alongside their output).

## Project structure

```
src/
├── App.js             # session handling, sign-in gate, top-level layout
├── GoogleAuth.js      # "Sign in with Google" button
├── ImageGrid.js       # folder picker + media grid + fullscreen viewer
├── driveApi.js        # every Drive REST call, auth headers and error mapping
├── folderFilter.js    # pure folder-visibility rules (unit tested)
├── App.css            # all component styling
└── *.test.js          # Jest + React Testing Library tests
```

## Testing and building

```bash
npm test          # Jest + React Testing Library
npm run build     # production bundle in ./build
npm run deploy    # publish ./build to GitHub Pages (gh-pages)
```

## Notes on how media is loaded

Files are downloaded with `fetch` and handed to the viewer as **object URLs**
(`URL.createObjectURL`), held in a bounded LRU cache that revokes URLs when entries
are evicted. Earlier versions base64-encoded entire files into `data:` URLs, which
doubled memory use and overflowed the call stack on large files.

When Drive answers `401`, the app clears the stored session and returns you to the
sign-in screen instead of failing silently.

## Roadmap

- Server-side / authorization-code flow so long-lived sessions do not need a
  repeated sign-in.
- Thumbnail-level preloading (currently neighbours are fetched at full size).
- Batch operations (multi-select delete / move).
- Grid virtualisation for folders with thousands of files.

## License

MIT.
