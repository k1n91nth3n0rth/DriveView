import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const imageCache = {};

function ImageGrid({ accessToken }) {
    const [folders, setFolders] = useState([]);
    const [images, setImages] = useState([]);
    const [selectedFolder, setSelectedFolder] = useState(null);
    const [selectedImage, setSelectedImage] = useState(null);
    const [currentIndex, setCurrentIndex] = useState(null);
    const [image, setImage] = useState(null);
    const [destinationFolderId, setDestinationFolderId] = useState('');
    const [columns, setColumns] = useState(5); // Default to 5 columns



    const getImage = (fileId, isPrefetch = false) => {
        if (imageCache[fileId]) {
            if (!isPrefetch) {
                setImage(imageCache[fileId]);
            }
            return;
        }
    
        axios.get(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            params: {
                mimeType: "'image/jpeg'",
                alt: "media"
            },
            responseType: "arraybuffer"
        })
        .then((res) => {
            const base64 = btoa(
                new Uint8Array(res.data).reduce(
                    (data, byte) => data + String.fromCharCode(byte),
                    ''
                )
            );
            imageCache[fileId] = base64;
            if (!isPrefetch) {
                setImage(base64);
            }
        })
        .catch((error) => {
            console.error('Error fetching image:', error);
        });
    };

    const prefetchImages = (currentIndex) => {
        const start = Math.max(0, currentIndex - 10);
        const end = Math.min(images.length, currentIndex + 10);
    
        for (let i = start; i < end; i++) {
            if (i !== currentIndex) {
                getImage(images[i].id, true);
            }
        }
    };
    

    const handleImageClick = (image, index) => {
        getImage(image.id);
        setSelectedImage(image);
        setCurrentIndex(index);
    };

    const handleCloseFullscreen = () => {
        setSelectedImage(null);
        setCurrentIndex(null);
    };

    const handleDeleteImage = async () => {
        if (selectedImage) {
            try {
                await axios.patch(`https://www.googleapis.com/drive/v3/files/${selectedImage.id}`, 
                    {
                        trashed: true // Move to trash
                    },
                    {
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                        },
                    }
                );
    
                const newImages = images.filter(image => image.id !== selectedImage.id);
                setImages(newImages);
    
                if (newImages.length > 0) {
                    if (currentIndex < newImages.length) {
                        // Stay at the same index to show the next image
                        setCurrentIndex(currentIndex);
                        setSelectedImage(newImages[currentIndex]);
                    } else {
                        // Move to the previous image if the current one was the last
                        setCurrentIndex(currentIndex - 1);
                        setSelectedImage(newImages[currentIndex - 1]);
                    }
                } else {
                    // No more images left
                    setSelectedImage(null);
                    setCurrentIndex(null);
                }
            } catch (error) {
                console.error('Error deleting image:', error);
            }
        }
    };

    const handleAddToFavorites = async () => {
        if (selectedImage && destinationFolderId) {
            try {
                await axios.post(
                    `https://www.googleapis.com/drive/v3/files/${selectedImage.id}/copy`,
                    {
                        parents: [destinationFolderId],
                    },
                    {
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                        },
                    }
                );
            } catch (error) {
                console.error('Error adding image to selected folder:', error);
            }
        } else {
            alert("Please select a folder first.");
        }
    };    

    const handleFolderClick = async (folderId) => {
        setSelectedFolder(folderId);
        setSelectedImage(null);
        setCurrentIndex(null);
    
        let allImages = [];
        let nextPageToken = null;
    
        try {
            do {
                const response = await axios.get('https://www.googleapis.com/drive/v3/files', {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                    params: {
                        q: `'${folderId}' in parents AND trashed=false AND (mimeType='image/jpeg' OR mimeType='image/png' OR mimeType='image/gif' OR mimeType='image/bmp' OR mimeType='image/webp')`,
                        fields: 'nextPageToken, files(id, name, mimeType, thumbnailLink, webContentLink, webViewLink)',
                        pageSize: 1000,
                        pageToken: nextPageToken,
                    },
                });
    
                allImages = [...allImages, ...response.data.files];
                nextPageToken = response.data.nextPageToken;
            } while (nextPageToken);
    
            setImages(allImages);
        } catch (error) {
            console.error('Error fetching images:', error);
        }
    };
    

    const handleBackClick = () => {
        setSelectedFolder(null);
        setImages([]);
    };

    const handleKeyboardNavigation = useCallback((e) => {
        if (!selectedImage) return;

        if (e.key === 'ArrowLeft') {
            setCurrentIndex((prevIndex) => Math.max(prevIndex - 1, 0));
        } else if (e.key === 'ArrowRight') {
            setCurrentIndex((prevIndex) => Math.min(prevIndex + 1, images.length - 1));
        }
    }, [selectedImage, images.length]);

    const handleTouchStart = (e) => {
        const touchStartX = e.touches[0].clientX;
        const touchStartY = e.touches[0].clientY;
    
        const handleTouchEnd = (e) => {
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
    
            const deltaX = touchStartX - touchEndX;
            const deltaY = touchStartY - touchEndY;
    
            const swipeThreshold = 50;
    
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                // Horizontal swipe
                if (deltaX > swipeThreshold) {
                    setCurrentIndex((prevIndex) => Math.min(prevIndex + 1, images.length - 1));
                } else if (deltaX < -swipeThreshold) {
                    setCurrentIndex((prevIndex) => Math.max(prevIndex - 1, 0));
                }
            } else {
                // Vertical swipe (only handle swipe up)
                if (deltaY > swipeThreshold) {
                    handleDeleteImage(); // Swipe up to delete
                }
            }
    
            document.removeEventListener('touchend', handleTouchEnd);
        };
    
        document.addEventListener('touchend', handleTouchEnd);
    };
    

    useEffect(() => {
        if (currentIndex !== null && images.length > 0) {
            const newImage = images[currentIndex];
            setSelectedImage(newImage);
            getImage(newImage.id);
            prefetchImages(currentIndex); // Prefetch the next two images
        }
    }, [currentIndex, images]);

    useEffect(() => {
        const fetchFolders = async () => {
            try {
                let allFolders = [];
                let pageToken = null;
        
                do {
                    const response = await axios.get('https://www.googleapis.com/drive/v3/files', {
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                        },
                        params: {
                            q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
                            fields: 'nextPageToken, files(id, name, parents)',
                            pageSize: 1000,
                            pageToken: pageToken,
                        },
                    });
        
                    allFolders = [...allFolders, ...response.data.files];
                    pageToken = response.data.nextPageToken;
                } while (pageToken);
        
                // Build a map of folderId => folder
                const folderMap = {};
                allFolders.forEach(folder => {
                    folderMap[folder.id] = folder;
                });
        
                // Step 1: Find all ComfyUI folders
                const comfyUIFolders = allFolders.filter(f => f.name === 'ComfyUI');
                const comfyUIIds = new Set(comfyUIFolders.map(f => f.id));

                // Step 2: Mark descendants of ComfyUI folders for exclusion (except 'Output')
                const descendantsToExclude = new Set();
                const outputFolderIds = new Set();

                const markDescendants = (parentId) => {
                    for (const folder of allFolders) {
                        if (folder.parents && folder.parents.includes(parentId)) {
                            if (folder.name.toLowerCase() === 'output') {
                                outputFolderIds.add(folder.id); // Explicitly include output
                            } else {
                                descendantsToExclude.add(folder.id);
                                markDescendants(folder.id); // Continue recursion
                            }
                        }
                    }
                };

                comfyUIIds.forEach(markDescendants);

                // Also exclude the ComfyUI folders themselves
                comfyUIIds.forEach(id => descendantsToExclude.add(id));

                // Final filtered list: exclude everything marked EXCEPT 'Output' folders
                const filteredFolders = allFolders.filter(folder =>
                    !descendantsToExclude.has(folder.id) || outputFolderIds.has(folder.id)
                );

                setFolders(filteredFolders);

            } catch (error) {
                console.error('Error fetching folders:', error);
            }
        };
        
        

        fetchFolders();
    }, [accessToken]);

    useEffect(() => {
        if (currentIndex !== null && images.length > 0) {
            const newImage = images[currentIndex];
            setSelectedImage(newImage);
            getImage(newImage.id);
        }
    }, [currentIndex, images]);

    useEffect(() => {
        if (selectedImage) {
            document.addEventListener('keydown', handleKeyboardNavigation);
            return () => {
                document.removeEventListener('keydown', handleKeyboardNavigation);
            };
        }
    }, [selectedImage, handleKeyboardNavigation]);

    useEffect(() => {
        if (selectedImage) {
            document.addEventListener('touchstart', handleTouchStart);
            return () => {
                document.removeEventListener('touchstart', handleTouchStart);
            };
        }
    }, [selectedImage]);

    useEffect(() => {
        if (selectedImage) {
            // Disable background scroll
            document.body.style.overflow = 'hidden';
        } else {
            // Re-enable scroll
            document.body.style.overflow = '';
        }
    
        return () => {
            document.body.style.overflow = '';
        };
    }, [selectedImage]);

    const folderButtonStyle = {
        padding: '10px',
        fontSize: '16px',
        borderRadius: '5px',
        border: '1px solid #ccc',
        backgroundColor: '#f5f5f5',
        cursor: 'pointer',
        transition: 'background-color 0.3s',
        textAlign: 'center',
        boxSizing: 'border-box',
    };

    const folderGridStyle = {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '15px',
        padding: '20px',
    };

    const backButtonStyle = {
        padding: '10px 20px',
        fontSize: '16px',
        borderRadius: '5px',
        border: '1px solid #ccc',
        backgroundColor: '#f5f5f5',
        cursor: 'pointer',
        marginBottom: '20px',
        alignSelf: 'start',
    };

    const buttonContainerStyle = {
        position: 'absolute',
        bottom: '20px',
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        gap: '20px',
        paddingBottom: '1.5em', // Added padding from the bottom
    };

    const fullscreenButtonStyle = {
        padding: '10px 20px',
        fontSize: '16px',
        borderRadius: '5px',
        border: '1px solid #ccc',
        backgroundColor: '#f5f5f5',
        cursor: 'pointer',
    };

    return (
        <div className="image-grid-container">
            {!selectedFolder && (
                <div style={folderGridStyle}>
                    {folders.map((folder) => (
                        <button
                            key={folder.id}
                            style={folderButtonStyle}
                            onClick={() => handleFolderClick(folder.id)}
                        >
                            {folder.name}
                        </button>
                    ))}
                </div>
            )}

            {selectedFolder && (
                <>
                    <button style={backButtonStyle} onClick={handleBackClick}>
                        Back to Folders
                    </button>

                    {/* Destination Folder Dropdown */}
                    <select
                        value={destinationFolderId}
                        onChange={(e) => setDestinationFolderId(e.target.value)}
                        style={{
                            padding: '10px',
                            fontSize: '16px',
                            borderRadius: '5px',
                            border: '1px solid #ccc',
                            marginBottom: '10px',
                            backgroundColor: '#fff',
                            cursor: 'pointer',
                        }}
                    >
                        <option value="" disabled>
                            Select folder to copy
                        </option>
                        {folders.map((folder) => (
                            <option key={folder.id} value={folder.id}>
                                {folder.name}
                            </option>
                        ))}
                    </select>

                    {/* Column Selector */}
                    <div style={{ marginBottom: '10px' }}>
                        <label style={{ fontSize: '16px', marginRight: '10px' }}>
                            Number of columns:
                        </label>
                        <select
                            value={columns}
                            onChange={(e) => setColumns(Number(e.target.value))}
                            style={{
                                padding: '6px',
                                fontSize: '16px',
                                borderRadius: '5px',
                                border: '1px solid #ccc',
                                backgroundColor: '#fff',
                                cursor: 'pointer',
                            }}
                        >
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                                <option key={num} value={num}>
                                    {num}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Image Grid */}
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(${columns}, 1fr)`,
                            gap: '10px',
                            padding: '10px',
                        }}
                    >
                        {images.map((image, index) => (
                            <img
                                key={image.id}
                                src={image.thumbnailLink}
                                alt={image.name}
                                onClick={() => handleImageClick(image, index)}
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

            {selectedImage && (
                <div className="fullscreen-overlay">
                    <img
                        src={`data:;base64,${image}`}
                        alt={selectedImage.name}
                        className="fullscreen-image"
                        onClick={handleCloseFullscreen}
                    />

                    <div style={{ ...buttonContainerStyle, flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '20px' }}>
                            <button style={fullscreenButtonStyle} onClick={handleDeleteImage}>
                                Delete
                            </button>
                            <button style={fullscreenButtonStyle} onClick={handleAddToFavorites}>
                                Favorites
                            </button>
                            <button
                                style={fullscreenButtonStyle}
                                onClick={() => {
                                    const newWindow = window.open();
                                    newWindow.document.write(`
                                        <html>
                                            <head>
                                                <title>Image Viewer</title>
                                                <style>
                                                    body {
                                                        margin: 0;
                                                        background-color: #000;
                                                        display: flex;
                                                        align-items: center;
                                                        justify-content: center;
                                                        height: 100vh;
                                                    }
                                                    img {
                                                        max-width: 100%;
                                                        max-height: 100%;
                                                        object-fit: contain;
                                                    }
                                                </style>
                                            </head>
                                            <body>
                                                <img src="data:image/jpeg;base64,${image}" alt="Fullscreen Image" />
                                            </body>
                                        </html>
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
