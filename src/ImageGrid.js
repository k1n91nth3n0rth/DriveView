import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const mediaCache = {};

function ImageGrid({ accessToken }) {
    const [folders, setFolders] = useState([]);
    const [mediaFiles, setMediaFiles] = useState([]);
    const [selectedFolder, setSelectedFolder] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [currentIndex, setCurrentIndex] = useState(null);
    const [media, setMedia] = useState(null);
    const [destinationFolderId, setDestinationFolderId] = useState('');
    const [columns, setColumns] = useState(5);

    const getMedia = (fileId, mimeType, isPrefetch = false) => {
        if (mediaCache[fileId]) {
            if (!isPrefetch) setMedia(mediaCache[fileId]);
            return;
        }

        axios.get(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            responseType: "arraybuffer"
        })
        .then((res) => {
            const base64 = btoa(
                new Uint8Array(res.data).reduce(
                    (data, byte) => data + String.fromCharCode(byte), ''
                )
            );
            const dataUrl = `data:${mimeType};base64,${base64}`;
            mediaCache[fileId] = dataUrl;
            if (!isPrefetch) setMedia(dataUrl);
        })
        .catch((error) => {
            console.error('Error fetching media:', error);
        });
    };

    const prefetchMedia = (currentIndex) => {
        const start = Math.max(0, currentIndex - 10);
        const end = Math.min(mediaFiles.length, currentIndex + 10);

        for (let i = start; i < end; i++) {
            if (i !== currentIndex) {
                const file = mediaFiles[i];
                getMedia(file.id, file.mimeType, true);
            }
        }
    };

    const handleMediaClick = (file, index) => {
        getMedia(file.id, file.mimeType);
        setSelectedFile(file);
        setCurrentIndex(index);
    };

    const handleCloseFullscreen = () => {
        setSelectedFile(null);
        setCurrentIndex(null);
    };

    const handleDeleteMedia = async () => {
        if (selectedFile) {
            try {
                await axios.patch(
                    `https://www.googleapis.com/drive/v3/files/${selectedFile.id}`,
                    { trashed: true },
                    { headers: { Authorization: `Bearer ${accessToken}` } }
                );

                const newFiles = mediaFiles.filter(file => file.id !== selectedFile.id);
                setMediaFiles(newFiles);

                if (newFiles.length > 0) {
                    const newIndex = Math.min(currentIndex, newFiles.length - 1);
                    setCurrentIndex(newIndex);
                    setSelectedFile(newFiles[newIndex]);
                } else {
                    setSelectedFile(null);
                    setCurrentIndex(null);
                }
            } catch (error) {
                console.error('Error deleting media:', error);
            }
        }
    };

    const handleAddToFavorites = async () => {
        if (selectedFile && destinationFolderId) {
            try {
                await axios.post(
                    `https://www.googleapis.com/drive/v3/files/${selectedFile.id}/copy`,
                    { parents: [destinationFolderId] },
                    { headers: { Authorization: `Bearer ${accessToken}` } }
                );
            } catch (error) {
                console.error('Error adding to favorites:', error);
            }
        } else {
            alert("Please select a folder first.");
        }
    };

    const handleFolderClick = async (folderId) => {
        setSelectedFolder(folderId);
        setSelectedFile(null);
        setCurrentIndex(null);

        let allMedia = [];
        let nextPageToken = null;

        const queryMimeTypes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp',
            'video/mp4', 'video/webm', 'video/ogg'
        ];

        const mimeQuery = queryMimeTypes.map(m => `mimeType='${m}'`).join(' OR ');

        try {
            do {
                const response = await axios.get('https://www.googleapis.com/drive/v3/files', {
                    headers: { Authorization: `Bearer ${accessToken}` },
                    params: {
                        q: `'${folderId}' in parents AND trashed=false AND (${mimeQuery})`,
                        fields: 'nextPageToken, files(id, name, mimeType, thumbnailLink, webContentLink, webViewLink)',
                        pageSize: 1000,
                        pageToken: nextPageToken,
                    },
                });

                allMedia = [...allMedia, ...response.data.files];
                nextPageToken = response.data.nextPageToken;
            } while (nextPageToken);

            setMediaFiles(allMedia);
        } catch (error) {
            console.error('Error fetching media files:', error);
        }
    };

    const handleBackClick = () => {
        setSelectedFolder(null);
        setMediaFiles([]);
    };

    const handleKeyboardNavigation = useCallback((e) => {
        if (!selectedFile) return;
        if (e.key === 'ArrowLeft') {
            setCurrentIndex((prev) => Math.max(prev - 1, 0));
        } else if (e.key === 'ArrowRight') {
            setCurrentIndex((prev) => Math.min(prev + 1, mediaFiles.length - 1));
        }
    }, [selectedFile, mediaFiles.length]);

    const handleTouchStart = (e) => {
        const touchStartX = e.touches[0].clientX;
        const handleTouchEnd = (e) => {
            const touchEndX = e.changedTouches[0].clientX;
            const deltaX = touchStartX - touchEndX;
            if (Math.abs(deltaX) > 50) {
                if (deltaX > 0) {
                    setCurrentIndex((prev) => Math.min(prev + 1, mediaFiles.length - 1));
                } else {
                    setCurrentIndex((prev) => Math.max(prev - 1, 0));
                }
            }
            document.removeEventListener('touchend', handleTouchEnd);
        };
        document.addEventListener('touchend', handleTouchEnd);
    };

    useEffect(() => {
        if (currentIndex !== null && mediaFiles.length > 0) {
            const file = mediaFiles[currentIndex];
            setSelectedFile(file);
            getMedia(file.id, file.mimeType);
            prefetchMedia(currentIndex);
        }
    }, [currentIndex, mediaFiles]);

    useEffect(() => {
        if (selectedFile) {
            document.addEventListener('keydown', handleKeyboardNavigation);
            document.addEventListener('touchstart', handleTouchStart);
            document.body.style.overflow = 'hidden';
            return () => {
                document.removeEventListener('keydown', handleKeyboardNavigation);
                document.removeEventListener('touchstart', handleTouchStart);
                document.body.style.overflow = '';
            };
        }
    }, [selectedFile, handleKeyboardNavigation]);

    useEffect(() => {
        const fetchFolders = async () => {
            try {
                let allFolders = [];
                let pageToken = null;

                do {
                    const response = await axios.get('https://www.googleapis.com/drive/v3/files', {
                        headers: { Authorization: `Bearer ${accessToken}` },
                        params: {
                            q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
                            fields: 'nextPageToken, files(id, name, parents)',
                            pageSize: 1000,
                            pageToken,
                        },
                    });

                    allFolders = [...allFolders, ...response.data.files];
                    pageToken = response.data.nextPageToken;
                } while (pageToken);

                const comfyUIFolders = allFolders.filter(f => f.name === 'ComfyUI');
                const comfyUIIds = new Set(comfyUIFolders.map(f => f.id));
                const descendantsToExclude = new Set();
                const outputFolderIds = new Set();

                const markDescendants = (parentId) => {
                    for (const folder of allFolders) {
                        if (folder.parents && folder.parents.includes(parentId)) {
                            if (folder.name.toLowerCase() === 'output') {
                                outputFolderIds.add(folder.id);
                            } else {
                                descendantsToExclude.add(folder.id);
                                markDescendants(folder.id);
                            }
                        }
                    }
                };

                comfyUIIds.forEach(markDescendants);
                comfyUIIds.forEach(id => descendantsToExclude.add(id));

                const filtered = allFolders.filter(folder =>
                    !descendantsToExclude.has(folder.id) || outputFolderIds.has(folder.id)
                );

                setFolders(filtered);
            } catch (error) {
                console.error('Error fetching folders:', error);
            }
        };

        fetchFolders();
    }, [accessToken]);

    const fullscreenOverlayStyle = {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'auto',
    };


    const folderButtonStyle = {
        padding: '10px', fontSize: '16px', borderRadius: '5px',
        border: '1px solid #ccc', backgroundColor: '#f5f5f5',
        cursor: 'pointer', textAlign: 'center',
    };

    const folderGridStyle = {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '15px',
        padding: '20px',
    };

    const fullscreenButtonStyle = {
        padding: '10px 20px', fontSize: '16px',
        borderRadius: '5px', border: '1px solid #ccc',
        backgroundColor: '#f5f5f5', cursor: 'pointer',
    };

    const buttonContainerStyle = {
        position: 'absolute',
        bottom: '20px',
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        gap: '20px',
    };

    return (
        <div className="image-grid-container">
            {!selectedFolder && (
                <div style={folderGridStyle}>
                    {folders.map(folder => (
                        <button key={folder.id} style={folderButtonStyle} onClick={() => handleFolderClick(folder.id)}>
                            {folder.name}
                        </button>
                    ))}
                </div>
            )}

            {selectedFolder && (
                <>
                    <button style={fullscreenButtonStyle} onClick={handleBackClick}>Back to Folders</button>
                    <select style={fullscreenButtonStyle} value={destinationFolderId} onChange={(e) => setDestinationFolderId(e.target.value)}>
                        <option value="" disabled>Select folder to copy</option>
                        {folders.map(folder => (
                            <option key={folder.id} value={folder.id}>{folder.name}</option>
                        ))}
                    </select>

                    <div style={{ marginBottom: '10px' }}>
                        <label style={{ fontSize: '16px', marginRight: '10px' }}>Number of columns:</label>
                        <select style={folderButtonStyle} value={columns} onChange={(e) => setColumns(Number(e.target.value))}>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                                <option key={num} value={num}>{num}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${columns}, 1fr)`,
                        gap: '10px',
                        padding: '10px'
                    }}>
                        {mediaFiles.map((file, index) => (
                            <img
                                key={file.id}
                                src={file.thumbnailLink}
                                alt={file.name}
                                onClick={() => handleMediaClick(file, index)}
                                style={{
                                    width: '100%',
                                    height: 'auto',
                                    objectFit: 'cover',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                }}
                            />
                        ))}
                    </div>
                </>
            )}

            {selectedFile && (
    <div
        className="fullscreen-overlay"
        style={fullscreenOverlayStyle}
        onClick={handleCloseFullscreen}
    >
        <div
            onClick={(e) => e.stopPropagation()}
            style={{
                maxWidth: '100%',
                maxHeight: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            {selectedFile.mimeType.startsWith('video/') ? (
                <video
                    src={media}
                    controls
                    autoPlay
                    loop
                    style={{
                        maxWidth: '100%',
                        maxHeight: '80vh',
                        borderRadius: '8px',
                        objectFit: 'contain',
                    }}
                />
            ) : (
                <img
                    src={media}
                    alt={selectedFile.name}
                    style={{
                        maxWidth: '100%',
                        maxHeight: '80vh',
                        borderRadius: '8px',
                        objectFit: 'contain',
                        cursor: 'pointer',
                    }}
                />
            )}

            <div style={{ ...buttonContainerStyle, marginTop: '20px' }}>
                <button style={fullscreenButtonStyle} onClick={handleDeleteMedia}>Delete</button>
                <button style={fullscreenButtonStyle} onClick={handleAddToFavorites}>Favorites</button>
                <button
                    style={fullscreenButtonStyle}
                    onClick={(e) => {
                        e.stopPropagation();
                        const newWindow = window.open();
                        newWindow.document.write(`
                            <html><head><title>Viewer</title></head><body style="margin:0; background:#000;">
                                ${selectedFile.mimeType.startsWith('video/') ?
                                `<video src="${media}" controls autoplay style="width:100%; height:100%"></video>` :
                                `<img src="${media}" style="max-width:100%; max-height:100%; object-fit:contain;">`}
                            </body></html>
                        `);
                    }}
                >
                    Open in New Tab
                </button>
            </div>
        </div>
    </div>
)}

        </div>
    );
}

export default ImageGrid;
