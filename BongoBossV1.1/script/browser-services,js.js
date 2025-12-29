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
console.log('Initializing Browse Services...');
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);
console.log('Firebase initialized successfully!');

// Global variables
let currentUser = null;
let currentIdNumber = null;
let allProviders = [];
let filteredProviders = [];
let currentPage = 1;
let itemsPerPage = 12;
let favorites = [];

// Filters
let selectedCategories = ['all'];
let minPrice = null;
let maxPrice = null;
let minRating = 0;
let sortBy = 'relevance';
let searchQuery = '';

// Initialize on page load
window.addEventListener('load', async () => {
    console.log('Page loaded');

    // Check authentication
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log('User authenticated:', user.uid);
            try {
                await loadUserData(user.uid);
                await loadFavorites();
            } catch (error) {
                console.error('Error loading user data:', error);
            }
        } else {
            console.log('No user authenticated - browsing as guest');
            displayUserInfo({ fullName: 'Guest' });
        }

        // Load services regardless of auth status
        await loadAllProviders();
    });
});

// Load user data
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

// Display user info
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

// Load favorites
async function loadFavorites() {
    if (!currentIdNumber) return;

    try {
        const favoritesRef = ref(database, `favorites/${currentIdNumber}`);
        const snapshot = await get(favoritesRef);

        if (snapshot.exists()) {
            const favoritesData = snapshot.val();
            favorites = Object.keys(favoritesData);
            console.log('Loaded favorites:', favorites.length);
        }
    } catch (error) {
        console.error('Error loading favorites:', error);
    }
}

// Load all providers
async function loadAllProviders() {
    const grid = document.getElementById('servicesGrid');
    grid.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i><p>Loading services...</p></div>';

    try {
        const usersRef = ref(database, 'users');
        const usersSnapshot = await get(usersRef);

        if (!usersSnapshot.exists()) {
            displayEmptyState('No services available yet');
            return;
        }

        const usersData = usersSnapshot.val();
        allProviders = [];

        // Get all providers with their services
        for (const [idNumber, userData] of Object.entries(usersData)) {
            if (userData.accountType === 'provider') {
                // Get provider's service packages
                const servicesRef = ref(database, `servicePackages/${idNumber}`);
                const servicesSnapshot = await get(servicesRef);

                if (servicesSnapshot.exists()) {
                    const servicesData = servicesSnapshot.val();

                    // Get provider's portfolio for images
                    const portfolioRef = ref(database, `portfolios/${idNumber}`);
                    const portfolioSnapshot = await get(portfolioRef);
                    let images = [];

                    if (portfolioSnapshot.exists()) {
                        const portfolioData = portfolioSnapshot.val();
                        images = Object.values(portfolioData)
                            .filter(p => p.images && p.images.length > 0)
                            .map(p => p.images[0].data);
                    }

                    // Create provider entry for each service package
                    Object.entries(servicesData).forEach(([serviceId, service]) => {
                        allProviders.push({
                            providerId: idNumber,
                            providerName: userData.fullName,
                            category: userData.serviceCategory,
                            serviceId: serviceId,
                            serviceName: service.packageName,
                            description: service.description,
                            price: service.price,
                            features: service.features || [],
                            deliveryTime: service.deliveryTime,
                            image: images.length > 0 ? images[0] : null,
                            rating: userData.rating || (4 + Math.random()).toFixed(1),
                            createdAt: service.createdAt || Date.now()
                        });
                    });
                }
            }
        }

        console.log('Loaded providers:', allProviders.length);

        if (allProviders.length === 0) {
            displayEmptyState('No services available yet');
            return;
        }

        // Apply filters and display
        applyFilters();

    } catch (error) {
        console.error('Error loading providers:', error);
        displayEmptyState('Error loading services. Please refresh the page.');
    }
}

// Apply all filters
function applyFilters() {
    filteredProviders = allProviders.filter(provider => {
        // Category filter
        if (!selectedCategories.includes('all') && !selectedCategories.includes(provider.category)) {
            return false;
        }

        // Price filter
        if (minPrice !== null && provider.price < minPrice) {
            return false;
        }
        if (maxPrice !== null && provider.price > maxPrice) {
            return false;
        }

        // Rating filter
        if (parseFloat(provider.rating) < minRating) {
            return false;
        }

        // Search query
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const matchesName = provider.providerName.toLowerCase().includes(query);
            const matchesService = provider.serviceName.toLowerCase().includes(query);
            const matchesDescription = provider.description.toLowerCase().includes(query);
            const matchesCategory = getCategoryDisplayName(provider.category).toLowerCase().includes(query);

            if (!matchesName && !matchesService && !matchesDescription && !matchesCategory) {
                return false;
            }
        }

        return true;
    });

    // Apply sorting
    applySorting();

    // Reset to first page
    currentPage = 1;

    // Display results
    displayServices();
    updateResultsCount();
}

// Apply sorting
function applySorting() {
    switch (sortBy) {
        case 'rating':
            filteredProviders.sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));
            break;
        case 'price-low':
            filteredProviders.sort((a, b) => a.price - b.price);
            break;
        case 'price-high':
            filteredProviders.sort((a, b) => b.price - a.price);
            break;
        case 'newest':
            filteredProviders.sort((a, b) => b.createdAt - a.createdAt);
            break;
        default: // relevance
            // Keep original order or add relevance scoring
            break;
    }
}

// Display services
function displayServices() {
    const grid = document.getElementById('servicesGrid');

    if (filteredProviders.length === 0) {
        displayEmptyState('No services match your filters');
        return;
    }

    // Calculate pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedProviders = filteredProviders.slice(startIndex, endIndex);

    // Clear grid
    grid.innerHTML = '';

    // Create service cards
    paginatedProviders.forEach(provider => {
        const card = createServiceCard(provider);
        grid.appendChild(card);
    });

    // Update pagination
    updatePagination();
}

// Create service card
function createServiceCard(provider) {
    const div = document.createElement('div');
    div.className = 'service-card';

    const isFavorited = favorites.includes(provider.providerId);

    div.innerHTML = `
        <div class="service-image">
            ${provider.image ?
            `<img src="${provider.image}" alt="${provider.serviceName}">` :
            `<div class="service-placeholder"><i class="fas fa-briefcase"></i></div>`
        }
            ${currentUser ? `
                <button class="favorite-btn ${isFavorited ? 'favorited' : ''}" onclick="toggleFavorite('${provider.providerId}', this)">
                    <i class="fas fa-heart"></i>
                </button>
            ` : ''}
        </div>
        <div class="service-body">
            <div class="provider-info">
                <div class="provider-avatar">
                    ${provider.providerName.charAt(0).toUpperCase()}
                </div>
                <div class="provider-details">
                    <div class="provider-name">${provider.providerName}</div>
                    <div class="provider-category">${getCategoryDisplayName(provider.category)}</div>
                </div>
            </div>
            <h3 class="service-title">${provider.serviceName}</h3>
            <p class="service-description">${provider.description}</p>
            <div class="service-footer">
                <div class="service-rating">
                    <i class="fas fa-star"></i>
                    <span>${provider.rating}</span>
                </div>
                <div class="service-price">R ${provider.price.toLocaleString()}</div>
            </div>
        </div>
    `;

    // Add click handler to view provider profile
    div.onclick = (e) => {
        if (!e.target.closest('.favorite-btn')) {
            window.location.href = `../customer pages/provider-profile.html?id=${provider.providerId}`;
        }
    };

    return div;
}

// Display empty state
function displayEmptyState(message) {
    const grid = document.getElementById('servicesGrid');
    grid.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-search"></i>
            <h3>${message}</h3>
            <p>Try adjusting your filters or search terms</p>
        </div>
    `;

    document.getElementById('pagination').style.display = 'none';
}

// Update results count
function updateResultsCount() {
    const resultsCount = document.getElementById('resultsCount');
    resultsCount.textContent = `${filteredProviders.length} service${filteredProviders.length !== 1 ? 's' : ''} found`;
}

// Update pagination
function updatePagination() {
    const totalPages = Math.ceil(filteredProviders.length / itemsPerPage);
    const pagination = document.getElementById('pagination');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const paginationInfo = document.getElementById('paginationInfo');

    if (totalPages <= 1) {
        pagination.style.display = 'none';
        return;
    }

    pagination.style.display = 'flex';
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;
    paginationInfo.textContent = `Page ${currentPage} of ${totalPages}`;
}

// Handle category filter
function handleCategoryFilter(checkbox) {
    const value = checkbox.value;

    if (value === 'all') {
        if (checkbox.checked) {
            selectedCategories = ['all'];
            document.querySelectorAll('#categoryFilters input[type="checkbox"]').forEach(cb => {
                if (cb.value !== 'all') cb.checked = false;
            });
        }
    } else {
        // Uncheck "All Categories"
        const allCheckbox = document.querySelector('#categoryFilters input[value="all"]');
        allCheckbox.checked = false;

        if (checkbox.checked) {
            selectedCategories = selectedCategories.filter(c => c !== 'all');
            selectedCategories.push(value);
        } else {
            selectedCategories = selectedCategories.filter(c => c !== value);
        }

        // If no categories selected, select all
        if (selectedCategories.length === 0) {
            selectedCategories = ['all'];
            allCheckbox.checked = true;
        }
    }

    console.log('Selected categories:', selectedCategories);
    applyFilters();
}

// Apply price filter
function applyPriceFilter() {
    const minPriceInput = document.getElementById('minPrice');
    const maxPriceInput = document.getElementById('maxPrice');

    minPrice = minPriceInput.value ? parseFloat(minPriceInput.value) : null;
    maxPrice = maxPriceInput.value ? parseFloat(maxPriceInput.value) : null;

    console.log('Price filter:', minPrice, maxPrice);
    applyFilters();
}

// Handle rating filter
function handleRatingFilter(radio) {
    minRating = radio.value === 'all' ? 0 : parseFloat(radio.value);
    console.log('Min rating:', minRating);
    applyFilters();
}

// Handle sort
function handleSort() {
    const sortSelect = document.getElementById('sortSelect');
    sortBy = sortSelect.value;
    console.log('Sort by:', sortBy);
    applyFilters();
}

// Perform search
function performSearch() {
    const searchInput = document.getElementById('searchInput');
    searchQuery = searchInput.value.trim();
    console.log('Search query:', searchQuery);
    applyFilters();
}

// Clear filters
function clearFilters() {
    // Reset category filters
    selectedCategories = ['all'];
    document.querySelectorAll('#categoryFilters input[type="checkbox"]').forEach(cb => {
        cb.checked = cb.value === 'all';
    });

    // Reset price filters
    document.getElementById('minPrice').value = '';
    document.getElementById('maxPrice').value = '';
    minPrice = null;
    maxPrice = null;

    // Reset rating filter
    document.querySelector('input[name="rating"][value="all"]').checked = true;
    minRating = 0;

    // Reset sort
    document.getElementById('sortSelect').value = 'relevance';
    sortBy = 'relevance';

    // Reset search
    document.getElementById('searchInput').value = '';
    searchQuery = '';

    console.log('Filters cleared');
    applyFilters();
}

// Change page
function changePage(direction) {
    currentPage += direction;
    displayServices();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Toggle favorite
async function toggleFavorite(providerId, button) {
    if (!currentUser || !currentIdNumber) {
        alert('Please login to add favorites');
        return;
    }

    try {
        const favoriteRef = ref(database, `favorites/${currentIdNumber}/${providerId}`);
        const isFavorited = favorites.includes(providerId);

        if (isFavorited) {
            // Remove from favorites
            await remove(favoriteRef);
            favorites = favorites.filter(id => id !== providerId);
            button.classList.remove('favorited');
            console.log('Removed from favorites');
        } else {
            // Add to favorites
            await set(favoriteRef, {
                addedAt: new Date().toISOString()
            });
            favorites.push(providerId);
            button.classList.add('favorited');
            console.log('Added to favorites');
        }
    } catch (error) {
        console.error('Error toggling favorite:', error);
        alert('Error updating favorites. Please try again.');
    }
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
window.handleCategoryFilter = handleCategoryFilter;
window.applyPriceFilter = applyPriceFilter;
window.handleRatingFilter = handleRatingFilter;
window.handleSort = handleSort;
window.performSearch = performSearch;
window.clearFilters = clearFilters;
window.changePage = changePage;
window.toggleFavorite = toggleFavorite;
window.handleLogout = handleLogout;

// Add enter key support for search
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
    }
});

console.log('Browse services script loaded successfully!');