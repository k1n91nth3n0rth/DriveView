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

    const getImage = (fileId) => {
        if (imageCache[fileId]) {
            setImage(imageCache[fileId]);
            return;
        }

        axios.get('https://www.googleapis.com/drive/v3/files/' + fileId, {
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
            setImage(base64);
        });
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

        const handleTouchEnd = (e) => {
            const touchEndX = e.changedTouches[0].clientX;

            if (touchStartX - touchEndX > 50) {
                setCurrentIndex((prevIndex) => Math.min(prevIndex + 1, images.length - 1));
            } else if (touchEndX - touchStartX > 50) {
                setCurrentIndex((prevIndex) => Math.max(prevIndex - 1, 0));
            }

            document.removeEventListener('touchend', handleTouchEnd);
        };

        document.addEventListener('touchend', handleTouchEnd);
    };

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

    return (
        <div className="image-grid-container">
            {!selectedFolder && (
                <div className="folder-list">
                    {folders.map((folder) => (
                        <button
                            key={folder.id}
                            onClick={() => handleFolderClick(folder.id)}
                        >
                            {folder.name}
                        </button>
                    ))}
                </div>
            )}

            {selectedFolder && (
                <>
                    {selectedImage && (
                        <div className="fullscreen-overlay" onClick={handleCloseFullscreen}>
                            <img src={`data:;base64,${image}`} alt={selectedImage.name} className="fullscreen-image" />
                        </div>
                    )}
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
        </div>
    );
}

export default ImageGrid;
