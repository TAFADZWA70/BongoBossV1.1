// Import Firebase functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, get, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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
console.log('Initializing Favorites Page...');
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// Global variables
let currentUserData = null;
let currentIdNumber = null;
let allFavorites = [];
let filteredFavorites = [];

// Check authentication on load
window.addEventListener('load', () => {
    console.log('Page loaded, checking authentication...');

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log('User authenticated:', user.uid);
            try {
                await loadUserData(user.uid);
                await loadFavorites();
            } catch (error) {
                console.error('Error loading favorites page:', error);
                alert('Error loading favorites. Please try again.');
            }
        } else {
            console.log('No user authenticated - redirecting to login');
            window.location.href = 'login.html';
        }
    });
});

// Load user data from database
async function loadUserData(uid) {
    try {
        console.log('Loading user data for UID:', uid);

        // Get ID number from userMappings
        const mappingRef = ref(database, `userMappings/${uid}`);
        const mappingSnapshot = await get(mappingRef);

        if (!mappingSnapshot.exists()) {
            throw new Error('User mapping not found');
        }

        currentIdNumber = mappingSnapshot.val().idNumber;
        console.log('Found ID number:', currentIdNumber);

        // Get full user data
        const userRef = ref(database, `users/${currentIdNumber}`);
        const userSnapshot = await get(userRef);

        if (!userSnapshot.exists()) {
            throw new Error('User data not found');
        }

        currentUserData = userSnapshot.val();
        console.log('User data loaded:', currentUserData);

        // Display user info
        displayUserInfo(currentUserData);
    } catch (error) {
        console.error('Error loading user data:', error);
        throw error;
    }
}

// Display user information
function displayUserInfo(userData) {
    const userNameElement = document.getElementById('userName');
    if (userNameElement) {
        userNameElement.textContent = userData.fullName || 'Customer';
    }

    const userAvatarElement = document.getElementById('userAvatar');
    if (userAvatarElement && userData.fullName) {
        userAvatarElement.textContent = userData.fullName.charAt(0).toUpperCase();
    }
}

// Load favorites from Firebase
async function loadFavorites() {
    try {
        console.log('Loading favorites for customer:', currentIdNumber);

        const favoritesRef = ref(database, `favorites/${currentIdNumber}`);
        const favoritesSnapshot = await get(favoritesRef);

        if (!favoritesSnapshot.exists()) {
            console.log('No favorites found');
            displayEmptyState();
            updateStats([], 0);
            return;
        }

        const favoritesData = favoritesSnapshot.val();
        const favoriteProviderIds = Object.keys(favoritesData);
        console.log('Found favorites:', favoriteProviderIds.length);

        // Load provider details for each favorite
        const providers = await Promise.all(
            favoriteProviderIds.map(async (providerId) => {
                try {
                    const providerRef = ref(database, `users/${providerId}`);
                    const providerSnapshot = await get(providerRef);

                    if (!providerSnapshot.exists()) {
                        return null;
                    }

                    const providerData = providerSnapshot.val();

                    // Get services count
                    const servicesRef = ref(database, `servicePackages/${providerId}`);
                    const servicesSnapshot = await get(servicesRef);
                    const servicesCount = servicesSnapshot.exists()
                        ? Object.keys(servicesSnapshot.val()).length
                        : 0;

                    // Get portfolio image
                    const portfolioRef = ref(database, `portfolios/${providerId}`);
                    const portfolioSnapshot = await get(portfolioRef);
                    let imageUrl = null;

                    if (portfolioSnapshot.exists()) {
                        const portfolioData = portfolioSnapshot.val();
                        const firstPortfolio = Object.values(portfolioData)[0];
                        if (firstPortfolio && firstPortfolio.images && firstPortfolio.images.length > 0) {
                            imageUrl = firstPortfolio.images[0].data;
                        }
                    }

                    return {
                        id: providerId,
                        name: providerData.fullName,
                        category: providerData.serviceCategory,
                        bio: providerData.bio || 'Professional service provider',
                        rating: providerData.rating || 4.5,
                        reviewCount: providerData.reviewCount || 0,
                        servicesCount: servicesCount,
                        image: imageUrl,
                        addedDate: favoritesData[providerId].addedDate || Date.now()
                    };
                } catch (error) {
                    console.error('Error loading provider:', providerId, error);
                    return null;
                }
            })
        );

        // Filter out null values
        allFavorites = providers.filter(p => p !== null);
        filteredFavorites = [...allFavorites];
        console.log('Loaded providers:', allFavorites.length);

        // Count bookings from favorites
        const bookingsCount = await countBookingsFromFavorites(favoriteProviderIds);

        // Display favorites
        displayFavorites(filteredFavorites);
        updateStats(filteredFavorites, bookingsCount);

        // Setup filter listeners
        setupFilters();

    } catch (error) {
        console.error('Error loading favorites:', error);
        displayEmptyState();
        updateStats([], 0);
    }
}

// Count bookings from favorite providers
async function countBookingsFromFavorites(providerIds) {
    try {
        const bookingsRef = ref(database, 'bookings');
        const bookingsSnapshot = await get(bookingsRef);

        if (!bookingsSnapshot.exists()) {
            return 0;
        }

        const allBookings = bookingsSnapshot.val();
        let count = 0;

        Object.values(allBookings).forEach(booking => {
            if (booking.customerId === currentIdNumber &&
                providerIds.includes(booking.providerId)) {
                count++;
            }
        });

        console.log('Bookings from favorites:', count);
        return count;

    } catch (error) {
        console.error('Error counting bookings:', error);
        return 0;
    }
}

// Display favorites
function displayFavorites(favorites) {
    const container = document.getElementById('favoritesContainer');

    if (!favorites || favorites.length === 0) {
        displayEmptyState();
        return;
    }

    container.innerHTML = '<div class="providers-grid"></div>';
    const grid = container.querySelector('.providers-grid');

    favorites.forEach(provider => {
        const card = createProviderCard(provider);
        grid.appendChild(card);
    });

    document.getElementById('favoritesCount').textContent =
        `${favorites.length} Favorite${favorites.length !== 1 ? 's' : ''}`;
}

// Create provider card element
function createProviderCard(provider) {
    const div = document.createElement('div');
    div.className = 'provider-card';

    const categoryName = getCategoryDisplayName(provider.category);
    const stars = generateStars(provider.rating);

    div.innerHTML = `
        <div class="favorite-badge" data-provider-id="${provider.id}">
            <i class="fas fa-heart"></i>
        </div>

        <div class="provider-header">
            <div class="provider-avatar">
                ${provider.image
            ? `<img src="${provider.image}" alt="${provider.name}">`
            : provider.name.charAt(0).toUpperCase()}
            </div>
            <div class="provider-info">
                <h3>${provider.name}</h3>
                <span class="provider-category">${categoryName}</span>
            </div>
        </div>

        <div class="provider-rating">
            <div class="stars">${stars}</div>
            <span class="rating-value">${provider.rating.toFixed(1)}</span>
            <span class="rating-count">(${provider.reviewCount} reviews)</span>
        </div>

        <p class="provider-description">${provider.bio}</p>

        <div class="provider-stats">
            <div class="stat-item">
                <i class="fas fa-briefcase"></i>
                <span>${provider.servicesCount} Service${provider.servicesCount !== 1 ? 's' : ''}</span>
            </div>
            <div class="stat-item">
                <i class="fas fa-clock"></i>
                <span>Added ${formatDate(provider.addedDate)}</span>
            </div>
        </div>

        <div class="provider-actions">
            <button class="btn-view" data-provider-id="${provider.id}">
                <i class="fas fa-eye"></i>
                View Profile
            </button>
            <button class="btn-message" data-provider-id="${provider.id}">
                <i class="fas fa-comment"></i>
            </button>
        </div>
    `;

    // Add event listeners
    const favoriteBtn = div.querySelector('.favorite-badge');
    favoriteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeFavorite(provider.id);
    });

    const viewBtn = div.querySelector('.btn-view');
    viewBtn.addEventListener('click', () => viewProvider(provider.id));

    const messageBtn = div.querySelector('.btn-message');
    messageBtn.addEventListener('click', () => messageProvider(provider.id));

    return div;
}

// Generate star ratings HTML
function generateStars(rating) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= Math.floor(rating)) {
            stars += '<i class="fas fa-star"></i>';
        } else if (i - rating < 1) {
            stars += '<i class="fas fa-star-half-alt"></i>';
        } else {
            stars += '<i class="far fa-star"></i>';
        }
    }
    return stars;
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

// Format date
function formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 1) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return date.toLocaleDateString();
}

// Update statistics
function updateStats(favorites, bookingsCount) {
    // Total favorites
    document.getElementById('totalFavorites').textContent = favorites.length;

    // Unique categories
    const categories = new Set(favorites.map(f => f.category));
    document.getElementById('categoriesCount').textContent = categories.size;

    // Bookings made
    document.getElementById('bookingsMade').textContent = bookingsCount;

    // Average rating
    if (favorites.length > 0) {
        const avgRating = favorites.reduce((sum, f) => sum + f.rating, 0) / favorites.length;
        document.getElementById('avgRating').textContent = avgRating.toFixed(1);
    } else {
        document.getElementById('avgRating').textContent = '0.0';
    }
}

// Display empty state
function displayEmptyState() {
    const container = document.getElementById('favoritesContainer');
    container.innerHTML = `
        <div class="empty-state">
            <div class="icon">
                <i class="fas fa-heart"></i>
            </div>
            <h3>No Favorites Yet</h3>
            <p>Start adding your favorite service providers to see them here.</p>
            <a href="../customer pages/browse-services.html" class="btn-browse">
                <i class="fas fa-search"></i>
                Browse Services
            </a>
        </div>
    `;

    document.getElementById('favoritesCount').textContent = '0 Favorites';
}

// Setup filter listeners
function setupFilters() {
    // Search input
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', applyFilters);

    // Category filter
    const categoryFilter = document.getElementById('categoryFilter');
    categoryFilter.addEventListener('change', applyFilters);

    // Sort filter
    const sortFilter = document.getElementById('sortFilter');
    sortFilter.addEventListener('change', applyFilters);
}

// Apply filters
function applyFilters() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const categoryFilter = document.getElementById('categoryFilter').value;
    const sortFilter = document.getElementById('sortFilter').value;

    // Filter favorites
    filteredFavorites = allFavorites.filter(provider => {
        // Search filter
        const matchesSearch = provider.name.toLowerCase().includes(searchTerm) ||
            getCategoryDisplayName(provider.category).toLowerCase().includes(searchTerm);

        // Category filter
        const matchesCategory = categoryFilter === 'all' || provider.category === categoryFilter;

        return matchesSearch && matchesCategory;
    });

    // Sort favorites
    switch (sortFilter) {
        case 'recent':
            filteredFavorites.sort((a, b) => b.addedDate - a.addedDate);
            break;
        case 'rating':
            filteredFavorites.sort((a, b) => b.rating - a.rating);
            break;
        case 'name':
            filteredFavorites.sort((a, b) => a.name.localeCompare(b.name));
            break;
    }

    // Display filtered results
    displayFavorites(filteredFavorites);
}

// Remove favorite
async function removeFavorite(providerId) {
    if (!confirm('Remove this provider from your favorites?')) {
        return;
    }

    try {
        console.log('Removing favorite:', providerId);

        const favoriteRef = ref(database, `favorites/${currentIdNumber}/${providerId}`);
        await remove(favoriteRef);

        console.log('Favorite removed successfully');

        // Remove from local arrays
        allFavorites = allFavorites.filter(f => f.id !== providerId);
        filteredFavorites = filteredFavorites.filter(f => f.id !== providerId);

        // Refresh display
        displayFavorites(filteredFavorites);

        // Recalculate bookings count
        const favoriteProviderIds = allFavorites.map(f => f.id);
        const bookingsCount = await countBookingsFromFavorites(favoriteProviderIds);
        updateStats(filteredFavorites, bookingsCount);

    } catch (error) {
        console.error('Error removing favorite:', error);
        alert('Error removing favorite. Please try again.');
    }
}

// View provider profile
function viewProvider(providerId) {
    console.log('Viewing provider:', providerId);
    window.location.href = `../customer pages/browse-services.html?provider=${providerId}`;
}

// Message provider
function messageProvider(providerId) {
    console.log('Messaging provider:', providerId);
    window.location.href = `../message.html?provider=${providerId}`;
}

// Handle logout
async function handleLogout() {
    console.log('Logout initiated');

    if (confirm('Are you sure you want to logout?')) {
        try {
            await signOut(auth);
            localStorage.removeItem('bongoboss_user');
            sessionStorage.removeItem('bongoboss_user');
            console.log('Logout successful');
            window.location.href = 'index.html';
        } catch (error) {
            console.error('Logout error:', error);
            alert('Error logging out. Please try again.');
        }
    }
}

// Make functions globally accessible
window.handleLogout = handleLogout;

console.log('Favorites page script loaded successfully!');