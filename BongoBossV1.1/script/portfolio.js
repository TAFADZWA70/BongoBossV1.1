// Import Firebase functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, set, get, update, remove, push, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAtpKBpvPXzcWT4PIGHKWwmAwjsfX5zuYk",
    authDomain: "bongobossv1.firebaseapp.com",
    databaseURL: "https://bongobossv1-default-rtdb.firebaseio.com",
    projectId: "bongobossv1",
    storageBucket: "bongobossv1.firebasestorage.app",
    messagingSenderId: "701091823758",
    appId: "1:701091823758:web:6f4e2a1b42fd0248aac9df"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// Global variables
let currentUser = null;
let currentIdNumber = null;
let selectedFiles = [];

// Initialize on page load
window.addEventListener('load', async () => {
    console.log('Portfolio page loaded');

    // Check authentication
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log('User authenticated:', user.uid);
            try {
                await loadUserData(user.uid);
                await initializePortfolio();
            } catch (error) {
                console.error('Error initializing portfolio:', error);
                alert('Error loading portfolio. Please try again.');
                window.location.href = '../provider-dashboard.html';
            }
        } else {
            console.log('No user authenticated');
            alert('Please login to access this page');
            window.location.href = '../login.html';
        }
    });
});

// Load user data
async function loadUserData(uid) {
    try {
        // Get ID number from userMappings
        const mappingRef = ref(database, `userMappings/${uid}`);
        const mappingSnapshot = await get(mappingRef);

        if (!mappingSnapshot.exists()) {
            throw new Error('User mapping not found');
        }

        const mappingData = mappingSnapshot.val();
        currentIdNumber = mappingData.idNumber;
        console.log('Current ID Number:', currentIdNumber);

        // Get full user data
        const userRef = ref(database, `users/${currentIdNumber}`);
        const userSnapshot = await get(userRef);

        if (!userSnapshot.exists()) {
            throw new Error('User data not found');
        }

        currentUser = userSnapshot.val();
        console.log('User data loaded:', currentUser);

        // Verify user is a provider
        if (currentUser.accountType !== 'provider') {
            throw new Error('This page is for service providers only');
        }

    } catch (error) {
        console.error('Error loading user data:', error);
        throw error;
    }
}

// Initialize portfolio
async function initializePortfolio() {
    console.log('Initializing portfolio...');

    // Setup event listeners
    setupEventListeners();

    // Load portfolio data
    await loadPortfolioItems();
    await loadServicePackages();
    await loadCategories();
}

// Setup event listeners
function setupEventListeners() {
    // Tab navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            switchTab(tabName);
        });
    });

    // Add portfolio button
    document.getElementById('addPortfolioBtn').addEventListener('click', () => {
        openModal('addPortfolioModal');
    });

    // Add service button
    document.getElementById('addServiceBtn').addEventListener('click', () => {
        openModal('addServiceModal');
    });

    // Portfolio form submission
    document.getElementById('portfolioForm').addEventListener('submit', handlePortfolioSubmit);

    // Service form submission
    document.getElementById('serviceForm').addEventListener('submit', handleServiceSubmit);

    // Edit portfolio form submission
    document.getElementById('editPortfolioForm').addEventListener('submit', handleEditPortfolioSubmit);

    // Edit service form submission
    document.getElementById('editServiceForm').addEventListener('submit', handleEditServiceSubmit);

    // File upload
    document.getElementById('portfolioFileUpload').addEventListener('click', () => {
        document.getElementById('portfolioFile').click();
    });

    document.getElementById('portfolioFile').addEventListener('change', handleFileSelect);

    // Add feature button
    document.getElementById('addFeatureBtn').addEventListener('click', addFeatureInput);
    document.getElementById('addEditFeatureBtn').addEventListener('click', () => addFeatureInput(true));

    // Cancel buttons
    document.getElementById('cancelPortfolioBtn').addEventListener('click', () => {
        closeModal('addPortfolioModal');
    });

    document.getElementById('cancelServiceBtn').addEventListener('click', () => {
        closeModal('addServiceModal');
    });

    document.getElementById('cancelEditPortfolioBtn').addEventListener('click', () => {
        closeModal('editPortfolioModal');
    });

    document.getElementById('cancelEditServiceBtn').addEventListener('click', () => {
        closeModal('editServiceModal');
    });

    // Close modal buttons
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal');
            closeModal(modal.id);
        });
    });

    // Close modal on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', () => {
            const modal = overlay.closest('.modal');
            closeModal(modal.id);
        });
    });

    // Preview profile button
    document.getElementById('previewProfileBtn').addEventListener('click', () => {
        alert('Profile preview feature coming soon!');
    });
}

// Switch tabs
function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // Remove active class from all buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab
    document.getElementById(`${tabName}-tab`).classList.add('active');

    // Add active class to clicked button
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
}

// Open modal
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Close modal
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';

    // Reset forms
    if (modalId === 'addPortfolioModal') {
        document.getElementById('portfolioForm').reset();
        selectedFiles = [];
        document.getElementById('portfolioFilePreview').innerHTML = '';
    } else if (modalId === 'addServiceModal') {
        document.getElementById('serviceForm').reset();
        resetFeatureInputs();
    }
}

// Handle file selection
function handleFileSelect(e) {
    const files = Array.from(e.target.files);

    // Limit to 5 images to avoid database size issues
    if (files.length > 5) {
        alert('Maximum 5 images allowed (due to database storage limits)');
        return;
    }

    // Check file sizes (max 500KB per image)
    const oversizedFiles = files.filter(file => file.size > 500000);
    if (oversizedFiles.length > 0) {
        alert('Each image must be under 500KB. Please compress your images.');
        return;
    }

    selectedFiles = files;
    displayFilePreview(files);
}

// Display file preview
function displayFilePreview(files) {
    const preview = document.getElementById('portfolioFilePreview');
    preview.innerHTML = '';

    files.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const div = document.createElement('div');
            div.className = 'file-preview-item';
            div.innerHTML = `
                <img src="${e.target.result}" alt="Preview">
                <button type="button" class="file-preview-remove" data-index="${index}">
                    <i class="fas fa-times"></i>
                </button>
            `;

            div.querySelector('.file-preview-remove').addEventListener('click', () => {
                removeFile(index);
            });

            preview.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
}

// Remove file
function removeFile(index) {
    selectedFiles.splice(index, 1);
    displayFilePreview(selectedFiles);
}

// Add feature input
function addFeatureInput(isEdit = false) {
    const container = isEdit ?
        document.getElementById('editFeaturesContainer') :
        document.getElementById('featuresContainer');

    const div = document.createElement('div');
    div.className = 'feature-input-group';
    div.innerHTML = `
        <input type="text" class="form-input feature-input" placeholder="e.g., Free revisions" required>
        <button type="button" class="btn-icon remove-feature">
            <i class="fas fa-times"></i>
        </button>
    `;

    div.querySelector('.remove-feature').addEventListener('click', () => {
        div.remove();
    });

    container.appendChild(div);
}

// Reset feature inputs
function resetFeatureInputs() {
    const container = document.getElementById('featuresContainer');
    container.innerHTML = `
        <div class="feature-input-group">
            <input type="text" class="form-input feature-input" placeholder="e.g., 2 hours of shooting" required>
            <button type="button" class="btn-icon remove-feature" style="display: none;">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
}

// Convert file to base64 with compression
async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // Create canvas to compress image
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // Calculate new dimensions (max 800px width/height)
                let width = img.width;
                let height = img.height;
                const maxSize = 800;

                if (width > height) {
                    if (width > maxSize) {
                        height = (height * maxSize) / width;
                        width = maxSize;
                    }
                } else {
                    if (height > maxSize) {
                        width = (width * maxSize) / height;
                        height = maxSize;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                // Draw and compress
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to base64 with quality 0.7
                const base64 = canvas.toDataURL('image/jpeg', 0.7);
                resolve(base64);
            };

            img.onerror = reject;
            img.src = e.target.result;
        };

        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Convert images to base64
async function convertImagesToBase64(files) {
    const base64Images = [];

    for (const file of files) {
        try {
            const base64 = await fileToBase64(file);
            base64Images.push({
                data: base64,
                name: file.name,
                type: file.type
            });
            console.log('Image converted to base64:', file.name);
        } catch (error) {
            console.error('Error converting image:', error);
            throw new Error(`Failed to process image: ${file.name}`);
        }
    }

    return base64Images;
}

// Handle portfolio form submission
async function handlePortfolioSubmit(e) {
    e.preventDefault();

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Saving...</span>';
    submitBtn.disabled = true;

    try {
        const category = document.getElementById('portfolioCategory').value;
        const title = document.getElementById('portfolioTitle').value;
        const description = document.getElementById('portfolioDescription').value;
        const url = document.getElementById('portfolioUrl').value;

        if (selectedFiles.length === 0) {
            alert('Please select at least one image');
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            return;
        }

        // Convert images to base64
        console.log('Converting images to base64...');
        const base64Images = await convertImagesToBase64(selectedFiles);

        // Create portfolio item
        const portfolioRef = ref(database, `portfolios/${currentIdNumber}`);
        const newPortfolioRef = push(portfolioRef);

        const portfolioData = {
            category,
            title,
            description,
            url: url || null,
            images: base64Images,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        await set(newPortfolioRef, portfolioData);

        console.log('Portfolio item added successfully');
        alert('Portfolio item added successfully!');

        closeModal('addPortfolioModal');
        await loadPortfolioItems();

    } catch (error) {
        console.error('Error adding portfolio item:', error);
        alert(`Error adding portfolio item: ${error.message}`);
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// Handle service form submission
async function handleServiceSubmit(e) {
    e.preventDefault();

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Saving...</span>';
    submitBtn.disabled = true;

    try {
        const packageName = document.getElementById('packageName').value;
        const price = parseFloat(document.getElementById('packagePrice').value);
        const description = document.getElementById('packageDescription').value;
        const deliveryTime = document.getElementById('deliveryTime').value;

        // Get features
        const featureInputs = document.querySelectorAll('#featuresContainer .feature-input');
        const features = Array.from(featureInputs).map(input => input.value).filter(val => val.trim());

        if (features.length === 0) {
            alert('Please add at least one feature');
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            return;
        }

        // Create service package
        const servicesRef = ref(database, `servicePackages/${currentIdNumber}`);
        const newServiceRef = push(servicesRef);

        const serviceData = {
            packageName,
            price,
            description,
            features,
            deliveryTime: deliveryTime ? parseInt(deliveryTime) : null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        await set(newServiceRef, serviceData);

        console.log('Service package added successfully');
        alert('Service package added successfully!');

        closeModal('addServiceModal');
        await loadServicePackages();

    } catch (error) {
        console.error('Error adding service package:', error);
        alert('Error adding service package. Please try again.');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// Handle edit portfolio form submission
async function handleEditPortfolioSubmit(e) {
    e.preventDefault();

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Saving...</span>';
    submitBtn.disabled = true;

    try {
        const portfolioId = document.getElementById('editPortfolioId').value;
        const category = document.getElementById('editPortfolioCategory').value;
        const title = document.getElementById('editPortfolioTitle').value;
        const description = document.getElementById('editPortfolioDescription').value;
        const url = document.getElementById('editPortfolioUrl').value;

        const portfolioRef = ref(database, `portfolios/${currentIdNumber}/${portfolioId}`);

        const updates = {
            category,
            title,
            description,
            url: url || null,
            updatedAt: serverTimestamp()
        };

        await update(portfolioRef, updates);

        console.log('Portfolio item updated successfully');
        alert('Portfolio item updated successfully!');

        closeModal('editPortfolioModal');
        await loadPortfolioItems();

    } catch (error) {
        console.error('Error updating portfolio item:', error);
        alert('Error updating portfolio item. Please try again.');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// Handle edit service form submission
async function handleEditServiceSubmit(e) {
    e.preventDefault();

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Saving...</span>';
    submitBtn.disabled = true;

    try {
        const serviceId = document.getElementById('editServiceId').value;
        const packageName = document.getElementById('editPackageName').value;
        const price = parseFloat(document.getElementById('editPackagePrice').value);
        const description = document.getElementById('editPackageDescription').value;
        const deliveryTime = document.getElementById('editDeliveryTime').value;

        // Get features
        const featureInputs = document.querySelectorAll('#editFeaturesContainer .feature-input');
        const features = Array.from(featureInputs).map(input => input.value).filter(val => val.trim());

        if (features.length === 0) {
            alert('Please add at least one feature');
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            return;
        }

        const serviceRef = ref(database, `servicePackages/${currentIdNumber}/${serviceId}`);

        const updates = {
            packageName,
            price,
            description,
            features,
            deliveryTime: deliveryTime ? parseInt(deliveryTime) : null,
            updatedAt: serverTimestamp()
        };

        await update(serviceRef, updates);

        console.log('Service package updated successfully');
        alert('Service package updated successfully!');

        closeModal('editServiceModal');
        await loadServicePackages();

    } catch (error) {
        console.error('Error updating service package:', error);
        alert('Error updating service package. Please try again.');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// Load portfolio items
async function loadPortfolioItems() {
    const gallery = document.getElementById('portfolioGallery');
    gallery.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i><p>Loading portfolio items...</p></div>';

    try {
        const portfolioRef = ref(database, `portfolios/${currentIdNumber}`);
        const snapshot = await get(portfolioRef);

        if (!snapshot.exists()) {
            gallery.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-folder-open"></i>
                    <h3>No portfolio items yet</h3>
                    <p>Start showcasing your work by adding your first portfolio item</p>
                </div>
            `;
            return;
        }

        const portfolioData = snapshot.val();
        const portfolioItems = Object.keys(portfolioData).map(key => ({
            id: key,
            ...portfolioData[key]
        }));

        gallery.innerHTML = '';

        portfolioItems.forEach(item => {
            const div = document.createElement('div');
            div.className = 'portfolio-item';

            // Get first image (base64)
            const imageData = item.images && item.images.length > 0 ? item.images[0].data : null;

            div.innerHTML = `
                <div class="portfolio-image">
                    ${imageData ? `<img src="${imageData}" alt="${item.title}">` : '<i class="fas fa-image"></i>'}
                </div>
                <div class="portfolio-info">
                    <span class="portfolio-category">${getCategoryName(item.category)}</span>
                    <h3 class="portfolio-title">${item.title}</h3>
                    <p class="portfolio-description">${item.description}</p>
                    ${item.url ? `<a href="${item.url}" target="_blank" class="portfolio-url"><i class="fas fa-external-link-alt"></i> View Project</a>` : ''}
                    <div class="portfolio-actions">
                        <button class="edit-btn" data-id="${item.id}">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="delete-btn" data-id="${item.id}">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            `;

            // Add event listeners
            div.querySelector('.edit-btn').addEventListener('click', () => editPortfolioItem(item));
            div.querySelector('.delete-btn').addEventListener('click', () => deletePortfolioItem(item.id));

            gallery.appendChild(div);
        });

    } catch (error) {
        console.error('Error loading portfolio items:', error);
        gallery.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-circle"></i>
                <h3>Error loading portfolio</h3>
                <p>Please try refreshing the page</p>
            </div>
        `;
    }
}

// Load service packages
async function loadServicePackages() {
    const container = document.getElementById('servicePackages');
    container.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i><p>Loading service packages...</p></div>';

    try {
        const servicesRef = ref(database, `servicePackages/${currentIdNumber}`);
        const snapshot = await get(servicesRef);

        if (!snapshot.exists()) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-box-open"></i>
                    <h3>No service packages yet</h3>
                    <p>Create your first service package to start receiving bookings</p>
                </div>
            `;
            return;
        }

        const servicesData = snapshot.val();
        const services = Object.keys(servicesData).map(key => ({
            id: key,
            ...servicesData[key]
        }));

        container.innerHTML = '';

        services.forEach(service => {
            const div = document.createElement('div');
            div.className = 'service-package';

            div.innerHTML = `
                <div class="package-header">
                    <h3 class="package-name">${service.packageName}</h3>
                    <div class="package-price">R ${service.price.toLocaleString()}</div>
                </div>
                <p class="portfolio-description">${service.description}</p>
                <ul class="package-features">
                    ${service.features.map(feature => `<li>${feature}</li>`).join('')}
                    ${service.deliveryTime ? `<li>${service.deliveryTime} days delivery</li>` : ''}
                </ul>
                <div class="portfolio-actions">
                    <button class="edit-btn" data-id="${service.id}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="delete-btn" data-id="${service.id}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            `;

            // Add event listeners
            div.querySelector('.edit-btn').addEventListener('click', () => editServicePackage(service));
            div.querySelector('.delete-btn').addEventListener('click', () => deleteServicePackage(service.id));

            container.appendChild(div);
        });

    } catch (error) {
        console.error('Error loading service packages:', error);
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-circle"></i>
                <h3>Error loading services</h3>
                <p>Please try refreshing the page</p>
            </div>
        `;
    }
}

// Load categories
async function loadCategories() {
    const container = document.getElementById('categoriesGrid');

    try {
        // Get portfolio items to count by category
        const portfolioRef = ref(database, `portfolios/${currentIdNumber}`);
        const snapshot = await get(portfolioRef);

        const categoryCounts = {};

        if (snapshot.exists()) {
            const portfolioData = snapshot.val();
            Object.values(portfolioData).forEach(item => {
                const category = item.category;
                categoryCounts[category] = (categoryCounts[category] || 0) + 1;
            });
        }

        const categories = [
            { id: 'wedding', name: 'Wedding Photography', icon: 'fa-rings-wedding', description: 'Capture beautiful wedding moments' },
            { id: 'event', name: 'Event Photography', icon: 'fa-calendar-day', description: 'Corporate and social events' },
            { id: 'portrait', name: 'Portrait Photography', icon: 'fa-user-circle', description: 'Professional headshots and portraits' },
            { id: 'commercial', name: 'Commercial Photography', icon: 'fa-camera', description: 'Product and commercial photography' },
            { id: 'web', name: 'Web Development', icon: 'fa-code', description: 'Websites and web applications' },
            { id: 'mobile', name: 'Mobile Apps', icon: 'fa-mobile-alt', description: 'iOS and Android applications' },
            { id: 'design', name: 'Graphic Design', icon: 'fa-palette', description: 'Visual design and branding' },
            { id: 'other', name: 'Other Services', icon: 'fa-ellipsis-h', description: 'Other creative services' }
        ];

        container.innerHTML = '';

        categories.forEach(category => {
            const count = categoryCounts[category.id] || 0;

            const div = document.createElement('div');
            div.className = 'category-card';
            div.innerHTML = `
                <div class="category-icon">
                    <i class="fas ${category.icon}"></i>
                </div>
                <h3>${category.name}</h3>
                <p>${category.description}</p>
                <span class="item-count">${count} ${count === 1 ? 'item' : 'items'}</span>
            `;

            container.appendChild(div);
        });

    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

// Get category name
function getCategoryName(categoryId) {
    const categories = {
        'wedding': 'Wedding Photography',
        'event': 'Event Photography',
        'portrait': 'Portrait Photography',
        'commercial': 'Commercial Photography',
        'web': 'Web Development',
        'mobile': 'Mobile Apps',
        'design': 'Graphic Design',
        'other': 'Other'
    };
    return categories[categoryId] || categoryId;
}

// Edit portfolio item
function editPortfolioItem(item) {
    document.getElementById('editPortfolioId').value = item.id;
    document.getElementById('editPortfolioCategory').value = item.category;
    document.getElementById('editPortfolioTitle').value = item.title;
    document.getElementById('editPortfolioDescription').value = item.description;
    document.getElementById('editPortfolioUrl').value = item.url || '';

    openModal('editPortfolioModal');
}

// Edit service package
function editServicePackage(service) {
    document.getElementById('editServiceId').value = service.id;
    document.getElementById('editPackageName').value = service.packageName;
    document.getElementById('editPackagePrice').value = service.price;
    document.getElementById('editPackageDescription').value = service.description;
    document.getElementById('editDeliveryTime').value = service.deliveryTime || '';

    // Populate features
    const container = document.getElementById('editFeaturesContainer');
    container.innerHTML = '';

    service.features.forEach((feature, index) => {
        const div = document.createElement('div');
        div.className = 'feature-input-group';
        div.innerHTML = `
            <input type="text" class="form-input feature-input" value="${feature}" required>
            <button type="button" class="btn-icon remove-feature" ${index === 0 ? 'style="display: none;"' : ''}>
                <i class="fas fa-times"></i>
            </button>
        `;

        if (index > 0) {
            div.querySelector('.remove-feature').addEventListener('click', () => div.remove());
        }

        container.appendChild(div);
    });

    openModal('editServiceModal');
}

// Delete portfolio item
async function deletePortfolioItem(itemId) {
    if (!confirm('Are you sure you want to delete this portfolio item?')) {
        return;
    }

    try {
        const portfolioRef = ref(database, `portfolios/${currentIdNumber}/${itemId}`);
        await remove(portfolioRef);

        console.log('Portfolio item deleted successfully');
        alert('Portfolio item deleted successfully!');
        await loadPortfolioItems();
        await loadCategories();

    } catch (error) {
        console.error('Error deleting portfolio item:', error);
        alert('Error deleting portfolio item. Please try again.');
    }
}

// Delete service package
async function deleteServicePackage(serviceId) {
    if (!confirm('Are you sure you want to delete this service package?')) {
        return;
    }

    try {
        const serviceRef = ref(database, `servicePackages/${currentIdNumber}/${serviceId}`);
        await remove(serviceRef);

        console.log('Service package deleted successfully');
        alert('Service package deleted successfully!');
        await loadServicePackages();

    } catch (error) {
        console.error('Error deleting service package:', error);
        alert('Error deleting service package. Please try again.');
    }
}

console.log('Portfolio script loaded successfully!');