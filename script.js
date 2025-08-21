'use strict';

document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURATION ---	

    // Make sure to fill these with your actual Cloudinary details
    const CLOUDINARY_CLOUD_NAME = "saif";      // e.g. "dxabc123"
    const CLOUDINARY_UPLOAD_PRESET = "mit-gallery-preset";  // e.g. "mit-gallery-preset"
    // ------------------------------------

    const fetchGalleryData = async () => {
        try {
            // Added a cache-busting parameter to ensure you always get the latest JSON
            const response = await fetch(`gallery-data.json?v=${Date.now()}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error("Could not fetch gallery data:", error);
            return [];
        }
    };

    if (document.body.id === 'home-page') {
        // --- HOME PAGE LOGIC ---
        const galleryGrid = document.getElementById('gallery-grid');
        const searchInput = document.getElementById('search-input');
        const sortSelect = document.getElementById('sort-select');
        const lightbox = document.getElementById('lightbox');
        let photos = [];
        let currentPhotosInView = [];

        const renderGallery = (photosToRender) => {
            galleryGrid.innerHTML = '';
            if (photosToRender.length === 0) {
                galleryGrid.innerHTML = '<p class="loader">No photos to display.</p>';
                return;
            }
            photosToRender.forEach(photo => {
                const item = document.createElement('div');
                item.className = 'gallery-item';
                item.dataset.id = photo.id;
                item.innerHTML = `
                    <img src="${photo.src}" alt="${photo.title}" loading="lazy">
                    <div class="gallery-item-caption"><h3>${photo.title}</h3></div>`;
                galleryGrid.appendChild(item);
            });
        };

        const updateView = () => {
            let filteredPhotos = [...photos];
            const searchTerm = searchInput.value.toLowerCase();
            if (searchTerm) {
                filteredPhotos = filteredPhotos.filter(p => p.title.toLowerCase().includes(searchTerm));
            }
            switch (sortSelect.value) {
                case 'date': filteredPhotos.sort((a, b) => new Date(b.date) - new Date(a.date)); break;
                case 'title': filteredPhotos.sort((a, b) => a.title.localeCompare(b.title)); break;
            }
            currentPhotosInView = filteredPhotos;
            renderGallery(filteredPhotos);
        };

        const showLightbox = (id) => {
            const photoIndex = currentPhotosInView.findIndex(p => p.id == id);
            if (photoIndex === -1) return;
            const updateLightboxContent = (index) => {
                const photo = currentPhotosInView[index];
                lightbox.querySelector('#lightbox-image').src = photo.src;
                lightbox.querySelector('#lightbox-title').textContent = photo.title;
                lightbox.querySelector('#lightbox-description').textContent = photo.description;
                lightbox.dataset.currentIndex = index;
            };
            updateLightboxContent(photoIndex);
            lightbox.style.display = 'flex';
        };

        galleryGrid.addEventListener('click', (e) => {
            const item = e.target.closest('.gallery-item');
            if (item) showLightbox(item.dataset.id);
        });
        lightbox.querySelector('.lightbox-close-button').addEventListener('click', () => lightbox.style.display = 'none');
        lightbox.querySelector('.lightbox-prev-button').addEventListener('click', () => {
            let index = parseInt(lightbox.dataset.currentIndex) - 1;
            if (index < 0) index = currentPhotosInView.length - 1;
            showLightbox(currentPhotosInView[index].id);
        });
        lightbox.querySelector('.lightbox-next-button').addEventListener('click', () => {
            let index = parseInt(lightbox.dataset.currentIndex) + 1;
            if (index >= currentPhotosInView.length) index = 0;
            showLightbox(currentPhotosInView[index].id);
        });

        searchInput.addEventListener('input', updateView);
        sortSelect.addEventListener('change', updateView);

        (async () => {
            photos = await fetchGalleryData();
            updateView();
        })();
    }

    if (document.body.id === 'admin-page') {
        // --- ADMIN PAGE LOGIC ---
        const manageList = document.getElementById('manage-list');
        const uploadForm = document.getElementById('upload-form');
        const exportButton = document.getElementById('export-json-button');
        const uploadStatus = document.getElementById('upload-status');
        const uploadButton = document.getElementById('upload-button');
        let photos = [];

        const renderManageList = () => {
            manageList.innerHTML = '';
            photos.forEach(photo => {
                const item = document.createElement('div');
                item.className = 'manage-item';
                item.dataset.id = photo.id;
                item.draggable = true;
                item.innerHTML = `
                    <img src="${photo.src}" alt="${photo.title}" loading="lazy">
                    <div class="manage-item-info"><strong>${photo.title}</strong><p>${photo.date}</p></div>
                    <button class="delete-button" data-id="${photo.id}">&times;</button>`;
                manageList.appendChild(item);
            });
        };

        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
                alert("Cloudinary details are not configured in script.js!");
                return;
            }

            const file = e.target['file-input'].files[0];
            if (!file) {
                alert("Please select a file to upload.");
                return;
            }

            uploadButton.disabled = true;
            uploadStatus.textContent = 'Uploading image...';
            uploadStatus.style.color = 'inherit'; // Reset color

            const formData = new FormData();
            formData.append('file', file);
            // ✅ THIS LINE IS THE CRITICAL FIX ✅
            formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

            try {
                const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
                    method: 'POST',
                    body: formData,
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error.message || 'Cloudinary upload failed.');
                }
                
                const data = await response.json();
                const imageUrl = data.secure_url;

                const newEntry = {
                    id: Date.now(),
                    src: imageUrl,
                    title: e.target['image-title'].value,
                    date: e.target['image-date'].value,
                    description: e.target['image-description'].value,
                };

                photos.unshift(newEntry);
                renderManageList();
                uploadForm.reset();
                uploadStatus.textContent = 'Success! Remember to export your data.';
                uploadStatus.style.color = 'green';

            } catch (error) {
                console.error("Upload error:", error);
                uploadStatus.textContent = `Upload failed: ${error.message}`;
                uploadStatus.style.color = 'red';
            } finally {
                uploadButton.disabled = false;
            }
        });

        manageList.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-button')) {
                const idToDelete = parseInt(e.target.dataset.id);
                photos = photos.filter(p => p.id !== idToDelete);
                renderManageList();
            }
        });

        let draggedItem = null;
        manageList.addEventListener('dragstart', (e) => {
            draggedItem = e.target;
            setTimeout(() => e.target.classList.add('dragging'), 0);
        });
        manageList.addEventListener('dragend', (e) => {
            e.target.classList.remove('dragging');
            const newOrder = [...manageList.children].map(item => {
                const id = parseInt(item.dataset.id);
                return photos.find(p => p.id === id);
            });
            photos = newOrder;
        });
        manageList.addEventListener('dragover', (e) => {
            e.preventDefault();
            const afterElement = [...manageList.children].find(child => e.clientY < child.getBoundingClientRect().top + child.offsetHeight / 2);
            manageList.insertBefore(draggedItem, afterElement);
        });

        exportButton.addEventListener('click', () => {
            const jsonString = JSON.stringify(photos, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'gallery-data.json';
            a.click();
            URL.revokeObjectURL(url);
        });
        
        (async () => {
            photos = await fetchGalleryData();
            renderManageList();
        })();
    }
});

