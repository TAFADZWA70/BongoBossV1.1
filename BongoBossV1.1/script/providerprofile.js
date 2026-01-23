// Import Firebase functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, get, set, remove, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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
console.log('Initializing Provider Profile...');
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);
console.log('Firebase initialized successfully!');

// Global variables
let currentUser = null;
let currentIdNumber = null;
let providerId = null;
let providerData = null;
let isFavorited = false;
let currentImageIndex = 0;
let portfolioImages = [];
let currentModalImages = [];
let providerLocation = null;

// Get provider ID from URL
function getProviderIdFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

// Detect and update provider location
async function detectAndUpdateProviderLocation() {
    if (!providerId) return;

    console.log('Detecting location for provider:', providerId);

    // Check if provider already has location data
    if (providerData.location && providerData.location.city && providerData.location.province) {
        providerLocation = providerData.location;
        updateLocationDisplay();
        return;
    }

    // Try geolocation detection
    if (navigator.geolocation) {
        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                });
            });

            const { latitude, longitude } = position.coords;
            await reverseGeocode(latitude, longitude);
        } catch (error) {
            console.log('Geolocation failed, trying IP-based detection:', error.message);
            await detectLocationByIP();
        }
    } else {
        await detectLocationByIP();
    }
}

// Reverse geocode coordinates
async function reverseGeocode(lat, lon) {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`,
            {
                headers: {
                    'User-Agent': 'BongoBoss/1.0'
                }
            }
        );

        if (!response.ok) throw new Error('Geocoding failed');

        const data = await response.json();

        if (data && data.address) {
            const address = data.address;

            providerLocation = {
                latitude: lat,
                longitude: lon,
                city: address.city || address.town || address.village || address.suburb || '',
                province: mapToSouthAfricanProvince(address.state || address.province || ''),
                country: address.country || 'South Africa'
            };

            await saveProviderLocation();
            updateLocationDisplay();
        }
    } catch (error) {
        console.error('Reverse geocoding error:', error);
        await detectLocationByIP();
    }
}

// IP-based location detection
async function detectLocationByIP() {
    try {
        const response = await fetch('https://ipapi.co/json/');
        if (!response.ok) throw new Error('IP location failed');

        const data = await response.json();

        if (data) {
            providerLocation = {
                latitude: data.latitude,
                longitude: data.longitude,
                city: data.city || '',
                province: mapToSouthAfricanProvince(data.region || ''),
                country: data.country_name || 'South Africa'
            };

            await saveProviderLocation();
            updateLocationDisplay();
        }
    } catch (error) {
        console.error('IP location error:', error);
        // Fallback to default
        updateLocationDisplay();
    }
}

// Map province names
function mapToSouthAfricanProvince(provinceName) {
    if (!provinceName) return '';

    const provinceMap = {
        'gauteng': 'Gauteng',
        'western cape': 'Western Cape',
        'eastern cape': 'Eastern Cape',
        'northern cape': 'Northern Cape',
        'free state': 'Free State',
        'kwazulu-natal': 'KwaZulu-Natal',
        'kwazulu natal': 'KwaZulu-Natal',
        'limpopo': 'Limpopo',
        'mpumalanga': 'Mpumalanga',
        'north west': 'North West',
        'northwest': 'North West',
        'kzn': 'KwaZulu-Natal',
        'wc': 'Western Cape',
        'ec': 'Eastern Cape',
        'nc': 'Northern Cape',
        'fs': 'Free State',
        'gp': 'Gauteng',
        'lp': 'Limpopo',
        'mp': 'Mpumalanga',
        'nw': 'North West'
    };

    const normalized = provinceName.toLowerCase().trim();
    return provinceMap[normalized] || provinceName;
}

// Save provider location to database
async function saveProviderLocation() {
    if (!providerLocation || !providerId) return;

    try {
        const userRef = ref(database, `users/${providerId}`);
        await update(userRef, {
            location: {
                ...providerLocation,
                updatedAt: new Date().toISOString()
            }
        });
        console.log('Provider location saved');
    } catch (error) {
        console.error('Error saving location:', error);
    }
}

// Update location display
function updateLocationDisplay() {
    const locationElement = document.getElementById('providerLocation');

    if (providerLocation && providerLocation.city && providerLocation.province) {
        locationElement.textContent = `${providerLocation.city}, ${providerLocation.province}, South Africa`;
    } else if (providerData.city && providerData.province) {
        locationElement.textContent = `${providerData.city}, ${providerData.province}, South Africa`;
    } else if (providerData.location) {
        locationElement.textContent = providerData.location;
    } else {
        locationElement.textContent = 'South Africa';
    }
}

// Add portfolio styles (call once on page load)
function addPortfolioStyles() {
    const style = document.createElement('style');
    style.id = 'portfolio-styles';
    style.textContent = `
        .portfolio-scroll-wrapper::-webkit-scrollbar {
            height: 8px;
        }
        .portfolio-scroll-wrapper::-webkit-scrollbar-track {
            background: #f1f5f9;
            border-radius: 4px;
        }
        .portfolio-scroll-wrapper::-webkit-scrollbar-thumb {
            background: #6366f1;
            border-radius: 4px;
        }
        .portfolio-scroll-wrapper::-webkit-scrollbar-thumb:hover {
            background: #4f46e5;
        }
        .portfolio-item {
            flex: 0 0 300px;
            height: 250px;
            cursor: pointer;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .portfolio-item:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 12px rgba(0, 0, 0, 0.15);
        }
        .portfolio-item img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .portfolio-nav-btn {
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            background: white;
            border: none;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
            z-index: 10;
            transition: all 0.3s ease;
        }
        .portfolio-nav-btn:hover {
            background: #6366f1;
            color: white;
            transform: translateY(-50%) scale(1.1);
        }
        .portfolio-nav-btn:disabled {
            opacity: 0.3;
            cursor: not-allowed;
        }
        .portfolio-nav-btn.prev {
            left: 10px;
        }
        .portfolio-nav-btn.next {
            right: 10px;
        }
        .portfolio-counter {
            text-align: center;
            margin-top: 16px;
            color: #64748b;
            font-size: 14px;
        }
    `;
    document.head.appendChild(style);
}

// Initialize on page load
window.addEventListener('load', async () => {
    console.log('Page loaded');

    // Add portfolio styles once
    addPortfolioStyles();

    // Get provider ID from URL
    providerId = getProviderIdFromURL();

    if (!providerId) {
        alert('Provider not found');
        window.location.href = 'browse-services.html';
        return;
    }

    console.log('Loading provider:', providerId);

    // Check authentication
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log('User authenticated:', user.uid);
            try {
                await loadUserData(user.uid);
                await checkFavoriteStatus();
            } catch (error) {
                console.error('Error loading user data:', error);
            }
        } else {
            console.log('No user authenticated - viewing as guest');
            displayUserInfo({ fullName: 'Guest' });
        }

        // Load provider data
        await loadProviderData();

        // Detect and update location after provider data is loaded
        await detectAndUpdateProviderLocation();
    });
});

// Load current user data
async function loadUserData(uid) {
    try {
        const mappingRef = ref(database, `userMappings/${uid}`);
        const mappingSnapshot = await get(mappingRef);

        if (!mappingSnapshot.exists()) {
            throw new Error('User mapping not found');
        }

        const mappingData = mappingSnapshot.val();
        currentIdNumber = mappingData.idNumber;

        const userRef = ref(database, `users/${currentIdNumber}`);
        const userSnapshot = await get(userRef);

        if (!userSnapshot.exists()) {
            throw new Error('User data not found');
        }

        currentUser = userSnapshot.val();
        displayUserInfo(currentUser);

    } catch (error) {
        console.error('Error loading user data:', error);
        displayUserInfo({ fullName: 'Guest' });
    }
}

// Display user info in header
function displayUserInfo(userData) {
    const userNameElement = document.getElementById('userName');
    const userAvatarElement = document.getElementById('userAvatar');

    if (userNameElement) {
        userNameElement.textContent = userData.fullName || 'Guest';
    }

    if (userAvatarElement && userData.fullName) {
        const firstLetter = userData.fullName.charAt(0).toUpperCase();
        userAvatarElement.textContent = firstLetter;
    }
}

// Check if provider is favorited
async function checkFavoriteStatus() {
    if (!currentIdNumber || !providerId) return;

    try {
        const favoriteRef = ref(database, `favorites/${currentIdNumber}/${providerId}`);
        const snapshot = await get(favoriteRef);

        isFavorited = snapshot.exists();
        updateFavoriteButton();
    } catch (error) {
        console.error('Error checking favorite status:', error);
    }
}

// Update favorite button
function updateFavoriteButton() {
    const favoriteBtn = document.getElementById('favoriteBtn');
    const favoriteBtnText = document.getElementById('favoriteBtnText');

    if (favoriteBtn) {
        if (isFavorited) {
            favoriteBtn.classList.add('favorited');
            favoriteBtnText.textContent = 'Remove from Favorites';
        } else {
            favoriteBtn.classList.remove('favorited');
            favoriteBtnText.textContent = 'Add to Favorites';
        }
    }
}

// Load provider data
async function loadProviderData() {
    try {
        // Get provider user data
        const providerRef = ref(database, `users/${providerId}`);
        const providerSnapshot = await get(providerRef);

        if (!providerSnapshot.exists()) {
            throw new Error('Provider not found');
        }

        providerData = providerSnapshot.val();
        console.log('Provider data loaded:', providerData);

        // Display provider info
        displayProviderInfo();

        // Load services
        await loadProviderServices();

        // Load portfolio
        await loadProviderPortfolio();

        // Load reviews
        await loadProviderReviews();

        // Hide loading overlay
        document.getElementById('loadingState').style.display = 'none';

    } catch (error) {
        console.error('Error loading provider data:', error);
        alert('Error loading provider profile. Please try again.');
        window.location.href = 'browse-services.html';
    }
}

// Load completed jobs count from bookings
async function loadCompletedJobsCount() {
    try {
        const bookingsRef = ref(database, 'bookings');
        const bookingsSnapshot = await get(bookingsRef);

        let completedCount = 0;

        if (bookingsSnapshot.exists()) {
            const allBookingsData = bookingsSnapshot.val();

            // Count completed bookings for this provider
            completedCount = Object.values(allBookingsData).filter(
                booking => booking.providerId === providerId && booking.status === 'completed'
            ).length;
        }

        // Update the jobs completed display
        document.getElementById('providerJobs').textContent = completedCount > 0 ? `${completedCount}` : '0';

        console.log('Completed jobs count:', completedCount);

    } catch (error) {
        console.error('Error loading completed jobs count:', error);
        document.getElementById('providerJobs').textContent = '0';
    }
}

// Display provider information
function displayProviderInfo() {
    const firstLetter = providerData.fullName.charAt(0).toUpperCase();

    // Hero section
    document.getElementById('providerAvatarLarge').textContent = firstLetter;
    document.getElementById('providerName').textContent = providerData.fullName;
    document.getElementById('providerTitle').textContent = getCategoryDisplayName(providerData.serviceCategory);

    // Stats
    const rating = providerData.rating || (4 + Math.random()).toFixed(1);
    document.getElementById('providerRating').textContent = rating;
    document.getElementById('providerReviews').textContent = providerData.reviewCount || '0';

    // Get actual completed jobs count from bookings
    loadCompletedJobsCount();

    // Calculate years of experience (assuming account creation date)
    const yearsExperience = calculateYearsOfExperience(providerData.createdAt);
    document.getElementById('providerExperience').textContent = `${yearsExperience} yrs`;

    // Contact information
    document.getElementById('providerEmail').textContent = providerData.email || 'Not provided';
    document.getElementById('providerPhone').textContent = providerData.phone || 'Not provided';

    // Location will be updated by detectAndUpdateProviderLocation()
    // Set initial value
    if (providerData.city && providerData.province) {
        document.getElementById('providerLocation').textContent = `${providerData.city}, ${providerData.province}, South Africa`;
    } else {
        document.getElementById('providerLocation').textContent = providerData.location || 'South Africa';
    }

    // Bio
    const bioText = providerData.bio ||
        `Hi! I'm ${providerData.fullName}, a professional ${getCategoryDisplayName(providerData.serviceCategory).toLowerCase()} provider with years of experience. I specialize in delivering high-quality services that exceed expectations.`;
    document.getElementById('providerBio').textContent = bioText;

    // Skills
    displayProviderSkills();
}

// Display provider skills
function displayProviderSkills() {
    const skillsGrid = document.getElementById('providerSkills');

    let skills = [];

    // Get skills from provider data or generate based on category
    if (providerData.skills && providerData.skills.length > 0) {
        skills = providerData.skills;
    } else {
        // Default skills based on category
        skills = getDefaultSkillsForCategory(providerData.serviceCategory);
    }

    skillsGrid.innerHTML = '';
    skills.forEach(skill => {
        const tag = document.createElement('span');
        tag.className = 'skill-tag';
        tag.textContent = skill;
        skillsGrid.appendChild(tag);
    });
}

// Get default skills for category
function getDefaultSkillsForCategory(category) {
    const skillsMap = {
        'tech': ['Web Development', 'Mobile Apps', 'Database Design', 'Cloud Services', 'Tech Support'],
        'photography': ['Portrait Photography', 'Event Photography', 'Photo Editing', 'Lighting', 'Composition'],
        'creative': ['Graphic Design', 'Video Editing', 'Content Creation', 'Branding', 'Marketing'],
        'home': ['Repairs', 'Installations', 'Maintenance', 'Renovations', 'Quality Work'],
        'construction': ['Building', 'Renovations', 'Project Management', 'Quality Assurance', 'Safety'],
        'cleaning': ['Deep Cleaning', 'Regular Maintenance', 'Eco-Friendly', 'Attention to Detail', 'Reliability'],
        'business': ['Consulting', 'Strategy', 'Analysis', 'Planning', 'Implementation']
    };

    return skillsMap[category] || ['Professional Service', 'Quality Work', 'Customer Satisfaction', 'Reliability', 'Experience'];
}

// Calculate years of experience
function calculateYearsOfExperience(createdAt) {
    if (!createdAt) return '2';

    const created = new Date(createdAt);
    const now = new Date();
    const years = Math.max(1, Math.floor((now - created) / (1000 * 60 * 60 * 24 * 365)));
    return years;
}

// Load provider services
async function loadProviderServices() {
    const servicesGrid = document.getElementById('servicesGrid');

    try {
        const servicesRef = ref(database, `servicePackages/${providerId}`);
        const servicesSnapshot = await get(servicesRef);

        if (!servicesSnapshot.exists()) {
            servicesGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-briefcase"></i>
                    <p>No services available yet</p>
                </div>
            `;
            return;
        }

        const servicesData = servicesSnapshot.val();
        servicesGrid.innerHTML = '';

        Object.entries(servicesData).forEach(([serviceId, service]) => {
            const card = createServiceCard(serviceId, service);
            servicesGrid.appendChild(card);
        });

    } catch (error) {
        console.error('Error loading services:', error);
        servicesGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-circle"></i>
                <p>Error loading services</p>
            </div>
        `;
    }
}

// Create service card
function createServiceCard(serviceId, service) {
    const div = document.createElement('div');
    div.className = 'service-card';

    const rating = (4 + Math.random()).toFixed(1);
    const reviewCount = Math.floor(Math.random() * 50) + 5;

    div.innerHTML = `
        <div class="service-header">
            <h4>${service.packageName}</h4>
            <span class="service-price">R ${service.price.toLocaleString()}</span>
        </div>
        <p>${service.description}</p>
        ${service.features && service.features.length > 0 ? `
            <div class="service-features">
                <ul>
                    ${service.features.slice(0, 3).map(feature => `<li>${feature}</li>`).join('')}
                </ul>
            </div>
        ` : ''}
        <div class="service-footer">
            <div class="service-meta">
                <div class="service-rating">
                    <i class="fas fa-star"></i>
                    <span>${rating} (${reviewCount})</span>
                </div>
                ${service.deliveryTime ? `
                    <div class="service-delivery">
                        <i class="fas fa-clock"></i> ${service.deliveryTime}
                    </div>
                ` : ''}
            </div>
            <button class="book-service-btn" onclick="bookService('${serviceId}')">
                Book Now
            </button>
        </div>
    `;

    return div;
}

// Load provider portfolios - each portfolio displayed separately
async function loadProviderPortfolio() {
    try {
        // Get portfolios for THIS specific provider only
        const portfolioRef = ref(database, `portfolios/${providerId}`);
        const portfolioSnapshot = await get(portfolioRef);

        if (!portfolioSnapshot.exists()) {
            console.log('No portfolio found for provider:', providerId);
            return;
        }

        const portfolioData = portfolioSnapshot.val();
        const portfolioSection = document.getElementById('portfolioSection');
        const portfolioGrid = document.getElementById('portfolioGrid');

        portfolioGrid.innerHTML = '';

        // Create separate gallery for each portfolio
        Object.entries(portfolioData).forEach(([portfolioId, portfolio]) => {
            console.log('Loading portfolio:', portfolioId);

            if (portfolio.images && Array.isArray(portfolio.images) && portfolio.images.length > 0) {
                const portfolioContainer = createPortfolioSection(portfolioId, portfolio);
                portfolioGrid.appendChild(portfolioContainer);
            }
        });

        if (portfolioGrid.children.length > 0) {
            portfolioSection.style.display = 'block';
        } else {
            console.log('No portfolio images found for provider:', providerId);
        }

    } catch (error) {
        console.error('Error loading portfolio for provider', providerId, ':', error);
    }
}

// Create a separate section for each portfolio
function createPortfolioSection(portfolioId, portfolio) {
    const section = document.createElement('div');
    section.className = 'portfolio-section-item';
    section.style.cssText = 'margin-bottom: 40px;';

    // Portfolio header
    const header = document.createElement('div');
    header.style.cssText = 'margin-bottom: 20px;';
    header.innerHTML = `
        <h3 style="font-size: 20px; font-weight: 600; color: #1e293b; margin-bottom: 8px;">
            ${portfolio.title || 'Portfolio Collection'}
        </h3>
        ${portfolio.description ? `
            <p style="color: #64748b; font-size: 14px;">${portfolio.description}</p>
        ` : ''}
    `;
    section.appendChild(header);

    // Create gallery container for this portfolio
    const galleryContainer = document.createElement('div');
    galleryContainer.className = 'portfolio-gallery-container';
    galleryContainer.style.cssText = 'position: relative; overflow: hidden;';

    // Create scrollable wrapper
    const scrollWrapper = document.createElement('div');
    scrollWrapper.className = 'portfolio-scroll-wrapper';
    scrollWrapper.id = `portfolio-scroll-${portfolioId}`;
    scrollWrapper.style.cssText = `
        display: flex;
        gap: 16px;
        overflow-x: auto;
        scroll-behavior: smooth;
        padding: 10px 0;
        scrollbar-width: thin;
        scrollbar-color: #6366f1 #f1f5f9;
    `;

    // Store images for this specific portfolio
    const portfolioImages = portfolio.images.map((image, index) => ({
        src: image.data,
        title: portfolio.title || 'Portfolio item',
        description: portfolio.description || '',
        portfolioId: portfolioId,
        index: index
    }));

    // Add images to scroll wrapper
    portfolioImages.forEach((image, index) => {
        const item = document.createElement('div');
        item.className = 'portfolio-item';
        item.innerHTML = `<img src="${image.src}" alt="${image.title}">`;
        // Store the images array in a closure to pass to modal
        item.addEventListener('click', () => {
            openImageModalWithImages(portfolioImages, index);
        });
        scrollWrapper.appendChild(item);
    });

    // Create navigation buttons for this portfolio
    const prevBtn = document.createElement('button');
    prevBtn.className = 'portfolio-nav-btn prev';
    prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
    prevBtn.onclick = () => scrollPortfolioSection(portfolioId, 'prev');

    const nextBtn = document.createElement('button');
    nextBtn.className = 'portfolio-nav-btn next';
    nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
    nextBtn.onclick = () => scrollPortfolioSection(portfolioId, 'next');

    // Create counter for this portfolio
    const counter = document.createElement('div');
    counter.className = 'portfolio-counter';
    counter.id = `portfolio-counter-${portfolioId}`;
    counter.textContent = `1 / ${portfolioImages.length}`;

    // Assemble gallery
    galleryContainer.appendChild(prevBtn);
    galleryContainer.appendChild(nextBtn);
    galleryContainer.appendChild(scrollWrapper);
    section.appendChild(galleryContainer);
    section.appendChild(counter);

    // Update counter on scroll
    scrollWrapper.addEventListener('scroll', () => updatePortfolioCounterForSection(portfolioId, portfolioImages.length));

    return section;
}

// Scroll portfolio section by ID
function scrollPortfolioSection(portfolioId, direction) {
    const wrapper = document.getElementById(`portfolio-scroll-${portfolioId}`);
    const scrollAmount = 316; // item width (300) + gap (16)

    if (direction === 'prev') {
        wrapper.scrollLeft -= scrollAmount;
    } else {
        wrapper.scrollLeft += scrollAmount;
    }
}

// Update portfolio counter for specific section
function updatePortfolioCounterForSection(portfolioId, totalImages) {
    const wrapper = document.getElementById(`portfolio-scroll-${portfolioId}`);
    const counter = document.getElementById(`portfolio-counter-${portfolioId}`);
    const scrollAmount = 316;
    const currentIndex = Math.round(wrapper.scrollLeft / scrollAmount) + 1;

    if (counter) {
        counter.textContent = `${Math.min(currentIndex, totalImages)} / ${totalImages}`;
    }
}

// Open image modal with specific images array
function openImageModalWithImages(images, startIndex) {
    currentModalImages = images;
    currentImageIndex = startIndex;
    const image = images[startIndex];

    // Create modal
    const modal = document.createElement('div');
    modal.id = 'imageModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.95);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 20px;
    `;

    modal.innerHTML = `
        <button onclick="closeImageModal()" style="position: absolute; top: 20px; right: 20px; background: white; border: none; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; font-size: 20px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.2); z-index: 1001;">×</button>
        ${images.length > 1 ? `
            <button onclick="changeModalImage(-1)" style="position: absolute; left: 20px; top: 50%; transform: translateY(-50%); background: white; border: none; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.2); z-index: 1001; font-size: 24px;">‹</button>
            <button onclick="changeModalImage(1)" style="position: absolute; right: 20px; top: 50%; transform: translateY(-50%); background: white; border: none; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.2); z-index: 1001; font-size: 24px;">›</button>
        ` : ''}
        <div style="max-width: 90%; max-height: 90%; text-align: center;">
            <img src="${image.src}" alt="${image.title}" style="max-width: 100%; max-height: 80vh; object-fit: contain; border-radius: 8px; box-shadow: 0 8px 32px rgba(0,0,0,0.4);">
            <h3 style="color: white; margin-top: 16px; font-size: 20px;">${image.title}</h3>
            ${image.description ? `<p style="color: #cbd5e1; margin-top: 8px;">${image.description}</p>` : ''}
            ${images.length > 1 ? `<p style="color: #94a3b8; margin-top: 12px; font-size: 14px;">${startIndex + 1} / ${images.length}</p>` : ''}
        </div>
    `;

    document.body.appendChild(modal);

    // Close on click outside image
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeImageModal();
        }
    });

    // Close on escape key
    document.addEventListener('keydown', handleModalKeypress);
}

// Close image modal
function closeImageModal() {
    const modal = document.getElementById('imageModal');
    if (modal) {
        modal.remove();
        document.removeEventListener('keydown', handleModalKeypress);
    }
}

// Change image in modal
function changeModalImage(direction) {
    currentImageIndex += direction;

    if (currentImageIndex < 0) {
        currentImageIndex = currentModalImages.length - 1;
    } else if (currentImageIndex >= currentModalImages.length) {
        currentImageIndex = 0;
    }

    closeImageModal();
    openImageModalWithImages(currentModalImages, currentImageIndex);
}

// Handle modal keypress
function handleModalKeypress(e) {
    if (e.key === 'Escape') {
        closeImageModal();
    } else if (e.key === 'ArrowLeft' && currentModalImages.length > 1) {
        changeModalImage(-1);
    } else if (e.key === 'ArrowRight' && currentModalImages.length > 1) {
        changeModalImage(1);
    }
}

// Load provider reviews
async function loadProviderReviews() {
    const reviewsList = document.getElementById('reviewsList');
    const reviewCount = document.getElementById('reviewCount');

    try {
        // Get ALL reviews from the reviews node
        const reviewsRef = ref(database, 'reviews');
        const reviewsSnapshot = await get(reviewsRef);

        if (!reviewsSnapshot.exists()) {
            reviewsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-star"></i>
                    <p>No reviews yet</p>
                </div>
            `;
            reviewCount.textContent = '0';
            return;
        }

        const allReviews = reviewsSnapshot.val();

        // Filter reviews for THIS provider only
        const providerReviews = Object.entries(allReviews)
            .map(([id, review]) => ({
                id,
                ...review
            }))
            .filter(review => review.providerId === providerId && review.status === 'published');

        console.log('Found reviews for provider:', providerReviews.length);

        if (providerReviews.length === 0) {
            reviewsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-star"></i>
                    <p>No reviews yet</p>
                </div>
            `;
            reviewCount.textContent = '0';
            return;
        }

        reviewCount.textContent = providerReviews.length;
        reviewsList.innerHTML = '';

        // Sort by date (newest first)
        providerReviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        providerReviews.forEach(review => {
            const item = createReviewItem(review);
            reviewsList.appendChild(item);
        });

    } catch (error) {
        console.error('Error loading reviews:', error);
        reviewsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-circle"></i>
                <p>Error loading reviews</p>
            </div>
        `;
    }
}

// Create review item
function createReviewItem(review) {
    const div = document.createElement('div');
    div.className = 'review-item';

    const reviewerName = review.customerName || 'Anonymous';
    const reviewerInitial = reviewerName.charAt(0).toUpperCase();
    const date = formatDate(review.createdAt);

    div.innerHTML = `
        <div class="review-header">
            <div class="reviewer-info">
                <div class="reviewer-avatar">${reviewerInitial}</div>
                <div class="reviewer-details">
                    <h5>${reviewerName}</h5>
                    <span class="review-date">${date}</span>
                </div>
            </div>
            <div class="review-rating">
                ${[...Array(5)].map((_, i) =>
        `<i class="fas fa-star${i < review.rating ? '' : ' fa-regular'}"></i>`
    ).join('')}
            </div>
        </div>
        ${review.title ? `<h4 class="review-title">${review.title}</h4>` : ''}
        <p class="review-text">${review.review}</p>
        ${review.serviceName ? `
            <div class="review-service">
                <i class="fas fa-briefcase"></i> ${review.serviceName}
            </div>
        ` : ''}
    `;

    return div;
}

// Format date
function formatDate(dateString) {
    if (!dateString) return 'Recently';

    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 1) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
}

// Toggle provider favorite
async function toggleProviderFavorite() {
    if (!currentUser || !currentIdNumber) {
        alert('Please login to add favorites');
        return;
    }

    try {
        const favoriteRef = ref(database, `favorites/${currentIdNumber}/${providerId}`);

        if (isFavorited) {
            // Remove from favorites
            await remove(favoriteRef);
            isFavorited = false;
            console.log('Removed from favorites');
        } else {
            // Add to favorites
            await set(favoriteRef, {
                addedAt: new Date().toISOString()
            });
            isFavorited = true;
            console.log('Added to favorites');
        }

        updateFavoriteButton();
    } catch (error) {
        console.error('Error toggling favorite:', error);
        alert('Error updating favorites. Please try again.');
    }
}

// Book service
function bookService(serviceId) {
    if (!currentUser) {
        alert('Please login to book a service');
        window.location.href = '../login.html';
        return;
    }

    // Store booking info and redirect to booking page
    sessionStorage.setItem('bookingData', JSON.stringify({
        providerId: providerId,
        serviceId: serviceId,
        providerName: providerData.fullName,
        timestamp: new Date().toISOString()
    }));

    window.location.href = `booking.html?provider=${providerId}&service=${serviceId}`;
}

// Show booking modal
function showBookingModal() {
    if (!currentUser) {
        alert('Please login to book a service');
        window.location.href = '../login.html';
        return;
    }

    alert('Please select a specific service to book');
}

// Show contact modal
function showContactModal() {
    if (!currentUser) {
        alert('Please login to contact this provider');
        window.location.href = '../login.html';
        return;
    }

    const email = providerData.email;
    const phone = providerData.phone;

    let message = `Contact ${providerData.fullName}:\n\n`;
    if (email) message += `Email: ${email}\n`;
    if (phone) message += `Phone: ${phone}\n`;

    alert(message);
}

// Handle logout
async function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        try {
            await signOut(auth);
            localStorage.removeItem('bongoboss_user');
            sessionStorage.removeItem('bongoboss_user');
            window.location.href = '../index.html';
        } catch (error) {
            console.error('Logout error:', error);
            alert('Error logging out. Please try again.');
        }
    }
}

// Get category display name
function getCategoryDisplayName(category) {
    const categoryMap = {
        'tech': 'Tech & IT Services',
        'home': 'Home Services',
        'creative': 'Creative Services',
        'business': 'Business Services',
        'health': 'Health & Wellness',
        'construction': 'Construction',
        'transport': 'Moving & Transport',
        'landscaping': 'Landscaping',
        'cleaning': 'Cleaning Services',
        'maintenance': 'Maintenance',
        'photography': 'Photography',
        'property': 'Real Estate',
        'hotel': 'Hotel/Tourism'
    };

    return categoryMap[category] || category;
}

// Make functions globally accessible
window.toggleProviderFavorite = toggleProviderFavorite;
window.bookService = bookService;
window.showBookingModal = showBookingModal;
window.showContactModal = showContactModal;
window.handleLogout = handleLogout;
window.scrollPortfolioSection = scrollPortfolioSection;
window.openImageModalWithImages = openImageModalWithImages;
window.closeImageModal = closeImageModal;
window.changeModalImage = changeModalImage;

console.log('Provider profile script loaded successfully!');