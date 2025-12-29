// Import Firebase functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, get, set, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

// Get provider ID from URL
function getProviderIdFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

// Initialize on page load
window.addEventListener('load', async () => {
    console.log('Page loaded');

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
    document.getElementById('providerJobs').textContent = providerData.completedJobs || '0+';

    // Calculate years of experience (assuming account creation date)
    const yearsExperience = calculateYearsOfExperience(providerData.createdAt);
    document.getElementById('providerExperience').textContent = `${yearsExperience} yrs`;

    // Contact information
    document.getElementById('providerEmail').textContent = providerData.email || 'Not provided';
    document.getElementById('providerPhone').textContent = providerData.phone || 'Not provided';
    document.getElementById('providerLocation').textContent = providerData.location || 'Johannesburg, SA';

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

// Load provider portfolio
async function loadProviderPortfolio() {
    try {
        const portfolioRef = ref(database, `portfolios/${providerId}`);
        const portfolioSnapshot = await get(portfolioRef);

        if (!portfolioSnapshot.exists()) {
            return;
        }

        const portfolioData = portfolioSnapshot.val();
        const portfolioGrid = document.getElementById('portfolioGrid');
        const portfolioSection = document.getElementById('portfolioSection');

        portfolioGrid.innerHTML = '';

        Object.values(portfolioData).forEach(portfolio => {
            if (portfolio.images && portfolio.images.length > 0) {
                portfolio.images.forEach(image => {
                    const item = document.createElement('div');
                    item.className = 'portfolio-item';
                    item.innerHTML = `<img src="${image.data}" alt="${portfolio.title || 'Portfolio item'}">`;
                    portfolioGrid.appendChild(item);
                });
            }
        });

        if (portfolioGrid.children.length > 0) {
            portfolioSection.style.display = 'block';
        }

    } catch (error) {
        console.error('Error loading portfolio:', error);
    }
}

// Load provider reviews
async function loadProviderReviews() {
    const reviewsList = document.getElementById('reviewsList');
    const reviewCount = document.getElementById('reviewCount');

    try {
        const reviewsRef = ref(database, `reviews/${providerId}`);
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

        const reviewsData = reviewsSnapshot.val();
        const reviewsArray = Object.entries(reviewsData).map(([id, review]) => ({
            id,
            ...review
        }));

        reviewCount.textContent = reviewsArray.length;
        reviewsList.innerHTML = '';

        // Sort by date (newest first)
        reviewsArray.sort((a, b) => new Date(b.date) - new Date(a.date));

        reviewsArray.forEach(review => {
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

    const reviewerName = review.reviewerName || 'Anonymous';
    const reviewerInitial = reviewerName.charAt(0).toUpperCase();
    const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
    const date = formatDate(review.date);

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
        <p class="review-text">${review.comment}</p>
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
            window.location.href = 'index.html';
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

console.log('Provider profile script loaded successfully!');