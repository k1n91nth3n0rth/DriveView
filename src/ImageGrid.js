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

    const prefetchImages = (startIndex) => {
        for (let i = startIndex; i < Math.min(startIndex + 2, images.length); i++) {
            getImage(images[i].id, true);
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
                await axios.delete(`https://www.googleapis.com/drive/v3/files/${selectedImage.id}`, {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                });
    
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
        if (selectedImage) {
            try {
                const response = await axios.post(
                    `https://www.googleapis.com/drive/v3/files/${selectedImage.id}/copy`,
                    {
                        parents: ['1UX2QrSscOG57oWufb7yaG9WuuOV_J3Zz'],
                    },
                    {
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                        },
                    }
                );
            } catch (error) {
                console.error('Error adding image to Favorites:', error);
            }
        }
    };

    const handleFolderClick = async (folderId) => {
        setSelectedFolder(folderId);
        setSelectedImage(null);
        setCurrentIndex(null);

        try {
            const response = await axios.get('https://www.googleapis.com/drive/v3/files', {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
                params: {
                    q: `'${folderId}' in parents AND trashed=false AND (mimeType='image/jpeg' OR mimeType='image/png' OR mimeType='image/gif' OR mimeType='image/bmp' OR mimeType='image/webp')`,
                    fields: 'files(id, name, mimeType, thumbnailLink, webContentLink, webViewLink)',
                },
            });
            setImages(response.data.files);
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
            prefetchImages(currentIndex + 1); // Prefetch the next two images
        }
    }, [currentIndex, images]);

    useEffect(() => {
        const fetchFolders = async () => {
            try {
                const response = await axios.get('https://www.googleapis.com/drive/v3/files', {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                    params: {
                        q: "mimeType='application/vnd.google-apps.folder' AND trashed=false",
                        fields: 'files(id, name)',
                    },
                });
                setFolders(response.data.files);
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
                    <div className="image-grid">
                    {images.map((image, index) => (
                            <img
                                key={image.id}
                                src={image.thumbnailLink}
                                alt={image.name}
                                onClick={() => handleImageClick(image, index)}
                            />
                        ))}
                    </div>
                </>
            )}

            {selectedImage && (
                <div className="fullscreen-overlay">
                    {selectedImage && (
                        <>
                            <img src={`data:;base64,${image}`} alt={selectedImage.name} className="fullscreen-image" onClick={handleCloseFullscreen}/>
                            <div style={buttonContainerStyle}>
                                <button style={fullscreenButtonStyle} onClick={handleDeleteImage}>
                                    Delete
                                </button>
                                <button style={fullscreenButtonStyle} onClick={handleAddToFavorites}>
                                    Favorites
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

export default ImageGrid;
