import React, { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import {
  AuthError,
  copyFile,
  fetchFileBlob,
  listFolders,
  listMediaInFolder,
  trashFile,
} from './driveApi';
import { visibleFolders } from './folderFilter';

/**
 * Media is held in an object-URL cache keyed by Drive file id.
 *
 * Object URLs are cheap to hand to <img>/<video> and avoid the previous
 * approach of base64-encoding whole files into `data:` URLs, which doubled
 * memory use and blew the call stack on multi-megabyte files.
 *
 * The cache is a bounded LRU: evicted entries have their object URL revoked
 * so the browser can actually free the blob.
 */
const CACHE_LIMIT = 40;
const PREFETCH_RADIUS = 10;
const MAX_TEXT_PREVIEW_BYTES = 5 * 1024 * 1024;

const urlCache = new Map();
let protectedUrl = null;

function cacheGet(fileId) {
  if (!urlCache.has(fileId)) return null;
  const url = urlCache.get(fileId);
  // Re-insert so the map's iteration order keeps behaving as LRU order.
  urlCache.delete(fileId);
  urlCache.set(fileId, url);
  return url;
}

function cacheSet(fileId, url) {
  if (urlCache.has(fileId)) return;
  urlCache.set(fileId, url);
  evictCache();
}

function cacheDrop(fileId) {
  const url = urlCache.get(fileId);
  if (!url) return;
  urlCache.delete(fileId);
  URL.revokeObjectURL(url);
}

function evictCache() {
  let guard = 0;
  while (urlCache.size > CACHE_LIMIT && guard <= urlCache.size) {
    const [oldestId, oldestUrl] = urlCache.entries().next().value;
    urlCache.delete(oldestId);
    if (oldestUrl === protectedUrl) {
      // Never revoke what is currently on screen — rotate it to the back.
      urlCache.set(oldestId, oldestUrl);
      guard += 1;
      continue;
    }
    URL.revokeObjectURL(oldestUrl);
  }
}

const isVideo = (mimeType) => Boolean(mimeType && mimeType.startsWith('video/'));

function ImageGrid({ accessToken, onAuthExpired }) {
  const [folders, setFolders] = useState([]);
  const [foldersLoading, setFoldersLoading] = useState(true);
  const [foldersError, setFoldersError] = useState(null);

  const [mediaFiles, setMediaFiles] = useState([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState(null);

  const [selectedFolder, setSelectedFolder] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(null);

  const [mediaUrl, setMediaUrl] = useState(null);
  const [mediaFileLoading, setMediaFileLoading] = useState(false);
  const [mediaFileError, setMediaFileError] = useState(null);

  const [destinationFolderId, setDestinationFolderId] = useState('');
  const [columns, setColumns] = useState(5);
  const [notice, setNotice] = useState(null);

  const requestRef = useRef(0);
  const touchStartXRef = useRef(null);

  /** Derive the currently selected file from the index. */
  const selectedFile = currentIndex !== null ? mediaFiles[currentIndex] : null;

  /** Route auth failures to the parent; everything else stays local. */
  const handleError = useCallback(
    (error) => {
      if (error instanceof AuthError) {
        onAuthExpired?.();
        return true;
      }
      return false;
    },
    [onAuthExpired]
  );

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const loadMedia = useCallback(
    async (file, { background = false } = {}) => {
      const cached = cacheGet(file.id);
      if (cached) {
        if (!background) {
          protectedUrl = cached;
          setMediaUrl(cached);
          setMediaFileError(null);
        }
        return;
      }

      const requestId = background ? null : ++requestRef.current;
      if (!background) {
        setMediaUrl(null);
        setMediaFileLoading(true);
        setMediaFileError(null);
      }

      try {
        const blob = await fetchFileBlob(file.id, accessToken);
        const url = URL.createObjectURL(blob);
        cacheSet(file.id, url);
        if (!background && requestId === requestRef.current) {
          protectedUrl = url;
          setMediaUrl(url);
        }
      } catch (error) {
        if (handleError(error)) return;
        if (!background && requestId === requestRef.current) setMediaFileError(error.message);
      } finally {
        if (!background && requestId === requestRef.current) setMediaFileLoading(false);
      }
    },
    [accessToken, handleError]
  );

  const prefetchNeighbours = useCallback(
    (index) => {
      const start = Math.max(0, index - PREFETCH_RADIUS);
      const end = Math.min(mediaFiles.length, index + PREFETCH_RADIUS + 1);
      for (let i = start; i < end; i += 1) {
        if (i !== index) loadMedia(mediaFiles[i], { background: true });
      }
    },
    [mediaFiles, loadMedia]
  );

  // Fetch the folder list once the token is available.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setFoldersLoading(true);
      setFoldersError(null);
      try {
        const allFolders = await listFolders(accessToken);
        if (!cancelled) setFolders(visibleFolders(allFolders));
      } catch (error) {
        if (!cancelled && !handleError(error)) setFoldersError(error.message);
      } finally {
        if (!cancelled) setFoldersLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accessToken, handleError]);

  // Keep the fullscreen media in sync with the selected index.
  useEffect(() => {
    if (!selectedFile || currentIndex === null) return;
    loadMedia(selectedFile);
    prefetchNeighbours(currentIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, mediaFiles]);

  // Keyboard shortcuts + scroll lock while the viewer is open.
  useEffect(() => {
    if (!selectedFile) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setCurrentIndex(null);
      } else if (event.key === 'ArrowLeft') {
        setCurrentIndex((prev) => (prev === null ? prev : Math.max(prev - 1, 0)));
      } else if (event.key === 'ArrowRight') {
        setCurrentIndex((prev) =>
          prev === null ? prev : Math.min(prev + 1, mediaFiles.length - 1)
        );
      }
    };

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedFile, currentIndex, mediaFiles.length]);

  // Release every object URL when the grid unmounts.
  useEffect(
    () => () => {
      urlCache.forEach((url) => URL.revokeObjectURL(url));
      urlCache.clear();
      protectedUrl = null;
    },
    []
  );

  const handleFolderClick = async (folderId) => {
    setSelectedFolder(folderId);
    setCurrentIndex(null);
    setMediaUrl(null);
    setMediaFiles([]);
    setMediaError(null);
    setMediaLoading(true);

    try {
      setMediaFiles(await listMediaInFolder(folderId, accessToken));
    } catch (error) {
      if (!handleError(error)) setMediaError(error.message);
    } finally {
      setMediaLoading(false);
    }
  };

  const handleBackClick = () => {
    setSelectedFolder(null);
    setCurrentIndex(null);
    setMediaUrl(null);
    setMediaFiles([]);
    setMediaError(null);
  };

  const handleMediaClick = (file, index) => {
    setCurrentIndex(index);
  };

  const handleCloseFullscreen = () => {
    setCurrentIndex(null);
    setMediaUrl(null);
  };

  const handleDeleteMedia = async (event) => {
    event.stopPropagation();
    if (!selectedFile) return;

    try {
      await trashFile(selectedFile.id, accessToken);
      cacheDrop(selectedFile.id);

      const remaining = mediaFiles.filter((file) => file.id !== selectedFile.id);
      setMediaFiles(remaining);

      if (remaining.length === 0) {
        setCurrentIndex(null);
        setMediaUrl(null);
      } else {
        const nextIndex = Math.min(currentIndex ?? 0, remaining.length - 1);
        setCurrentIndex(nextIndex);
      }
      setNotice('Moved to trash.');
    } catch (error) {
      if (!handleError(error)) setNotice(`Delete failed: ${error.message}`);
    }
  };

  const handleAddToFavorites = async (event) => {
    event.stopPropagation();
    if (!selectedFile) return;
    if (!destinationFolderId) {
      setNotice('Pick a destination folder first.');
      return;
    }

    try {
      await copyFile(selectedFile.id, destinationFolderId, accessToken);
      setNotice('Copied to the selected folder.');
    } catch (error) {
      if (!handleError(error)) setNotice(`Copy failed: ${error.message}`);
    }
  };

  /**
   * Open the file's bytes as plain text in a new tab.
   *
   * Uses a `text/plain` blob URL rather than document.write()-ing the content
   * into a fresh document, so file contents can never execute as markup.
   */
  const handleViewAsText = async (event) => {
    event.stopPropagation();
    if (!selectedFile) return;

    try {
      const blob = await fetchFileBlob(selectedFile.id, accessToken);
      if (blob.size > MAX_TEXT_PREVIEW_BYTES) {
        setNotice('File is too large to preview as text.');
        return;
      }
      const textUrl = URL.createObjectURL(
        new Blob([await blob.text()], { type: 'text/plain;charset=utf-8' })
      );
      window.open(textUrl, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(textUrl), 60000);
    } catch (error) {
      if (!handleError(error)) setNotice(`Could not read file: ${error.message}`);
    }
  };

  const handleOpenInNewTab = (event) => {
    event.stopPropagation();
    if (mediaUrl) window.open(mediaUrl, '_blank', 'noopener,noreferrer');
  };

  const handleTouchStart = (event) => {
    touchStartXRef.current = event.touches[0].clientX;
  };

  const handleTouchEnd = (event) => {
    if (touchStartXRef.current === null) return;
    const deltaX = touchStartXRef.current - event.changedTouches[0].clientX;
    touchStartXRef.current = null;
    if (Math.abs(deltaX) <= 50) return;

    if (deltaX > 0) {
      setCurrentIndex((prev) => Math.min(prev + 1, mediaFiles.length - 1));
    } else {
      setCurrentIndex((prev) => Math.max(prev - 1, 0));
    }
  };

  const canGoBack = currentIndex !== null && currentIndex > 0;
  const canGoForward = currentIndex !== null && currentIndex < mediaFiles.length - 1;

  return (
    <div className="image-grid-container">
      {notice && (
        <p className="app-message" role="status">
          {notice}
        </p>
      )}

      {!selectedFolder && (
        <>
          {foldersLoading && <p className="status-line">Loading folders…</p>}
          {foldersError && (
            <p className="status-line status-error" role="alert">
              Could not load folders: {foldersError}
            </p>
          )}
          {!foldersLoading && !foldersError && folders.length === 0 && (
            <p className="status-line">No folders found in this Drive.</p>
          )}

          <div className="folder-grid">
            {folders.map((folder) => (
              <button
                key={folder.id}
                type="button"
                className="folder-button"
                onClick={() => handleFolderClick(folder.id)}
              >
                {folder.name}
              </button>
            ))}
          </div>
        </>
      )}

      {selectedFolder && (
        <>
          <div className="toolbar">
            <button type="button" className="btn" onClick={handleBackClick}>
              ← Back to folders
            </button>

            <label className="toolbar-field">
              <span>Copy to</span>
              <select
                className="btn"
                value={destinationFolderId}
                onChange={(event) => setDestinationFolderId(event.target.value)}
              >
                <option value="" disabled>
                  Select folder
                </option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="toolbar-field">
              <span>Columns</span>
              <select
                className="btn"
                value={columns}
                onChange={(event) => setColumns(Number(event.target.value))}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <option key={num} value={num}>
                    {num}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {mediaLoading && <p className="status-line">Loading media…</p>}
          {mediaError && (
            <p className="status-line status-error" role="alert">
              Could not load media: {mediaError}
            </p>
          )}
          {!mediaLoading && !mediaError && mediaFiles.length === 0 && (
            <p className="status-line">No images or videos in this folder.</p>
          )}

          <div
            className="media-grid"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {mediaFiles.map((file, index) => (
              <button
                key={file.id}
                type="button"
                className="media-tile"
                onClick={() => handleMediaClick(file, index)}
                title={file.name}
                aria-label={`Open ${file.name}`}
              >
                {file.thumbnailLink ? (
                  <img src={file.thumbnailLink} alt={file.name} loading="lazy" />
                ) : (
                  <span className="media-tile-fallback">
                    <span aria-hidden="true">{isVideo(file.mimeType) ? '🎬' : '🖼️'}</span>
                    <span className="media-tile-name">{file.name}</span>
                  </span>
                )}
                {isVideo(file.mimeType) && <span className="media-tile-badge">video</span>}
              </button>
            ))}
          </div>
        </>
      )}

      {selectedFile && (
        <div
          className="fullscreen-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={selectedFile.name}
          onClick={handleCloseFullscreen}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="fullscreen-content" onClick={(event) => event.stopPropagation()}>
            {mediaFileLoading && <p className="status-line">Loading file…</p>}
            {mediaFileError && (
              <p className="status-line status-error" role="alert">
                Could not load file: {mediaFileError}
              </p>
            )}

            {!mediaFileLoading &&
              !mediaFileError &&
              mediaUrl &&
              (isVideo(selectedFile.mimeType) ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video
                  src={mediaUrl}
                  controls
                  autoPlay
                  loop
                  playsInline
                  className="viewer-media"
                />
              ) : (
                <img src={mediaUrl} alt={selectedFile.name} className="viewer-media" />
              ))}

            <div className="viewer-toolbar">
              <button
                type="button"
                className="btn"
                onClick={() => setCurrentIndex((prev) => Math.max(prev - 1, 0))}
                disabled={!canGoBack}
                aria-label="Previous file"
              >
                ←
              </button>
              <button type="button" className="btn" onClick={handleDeleteMedia}>
                Delete
              </button>
              <button type="button" className="btn" onClick={handleAddToFavorites}>
                Copy to folder
              </button>
              <button type="button" className="btn" onClick={handleViewAsText}>
                View as text
              </button>
              <button
                type="button"
                className="btn"
                onClick={handleOpenInNewTab}
                disabled={!mediaUrl}
              >
                Open in new tab
              </button>
              <button
                type="button"
                className="btn"
                onClick={() =>
                  setCurrentIndex((prev) => Math.min(prev + 1, mediaFiles.length - 1))
                }
                disabled={!canGoForward}
                aria-label="Next file"
              >
                →
              </button>
              <button
                type="button"
                className="btn"
                onClick={handleCloseFullscreen}
                aria-label="Close viewer"
              >
                ✕
              </button>
            </div>

            <p className="viewer-caption">
              {selectedFile.name}
              {currentIndex !== null && mediaFiles.length > 0
                ? ` — ${currentIndex + 1} / ${mediaFiles.length}`
                : ''}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default ImageGrid;