// Import Firebase functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, get, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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
console.log('Initializing Customer Dashboard...');
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);
console.log('Firebase initialized successfully!');

// Global user data
let currentUserData = null;
let currentIdNumber = null;

// Check authentication on load
window.addEventListener('load', async () => {
    console.log('Page loaded, checking authentication...');

    // Show loading state
    showLoadingState();

    // Check if user is logged in
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log('User authenticated:', user.uid);
            try {
                await loadUserData(user.uid);
                await loadDashboardData();
                hideLoadingState();
            } catch (error) {
                console.error('Error loading dashboard:', error);
                handleAuthError();
            }
        } else {
            console.log('No user authenticated');
            handleAuthError();
        }
    });
});

// Show loading state
function showLoadingState() {
    const userName = document.getElementById('userName');
    const userRole = document.getElementById('userRole');

    if (userName) userName.textContent = 'Loading...';
    if (userRole) userRole.textContent = 'Please wait...';
}

// Hide loading state
function hideLoadingState() {
    console.log('Dashboard loaded successfully');
}

// Handle authentication errors
function handleAuthError() {
    console.error('Authentication error - redirecting to login');

    // Check session storage as fallback
    const storedUser = localStorage.getItem('bongoboss_user') || sessionStorage.getItem('bongoboss_user');

    if (!storedUser) {
        alert('Please login to access the dashboard');
        window.location.href = 'login.html';
    } else {
        // Try to use stored data
        try {
            const userData = JSON.parse(storedUser);
            console.log('Using stored user data:', userData);
            displayUserInfo(userData);

            // Still prompt for fresh login after a delay
            setTimeout(() => {
                if (confirm('Your session may have expired. Would you like to login again for full access?')) {
                    window.location.href = 'login.html';
                }
            }, 2000);
        } catch (error) {
            console.error('Error parsing stored data:', error);
            alert('Session expired. Please login again.');
            window.location.href = 'login.html';
        }
    }
}

// Load user data from database
async function loadUserData(uid) {
    try {
        console.log('Loading user data for UID:', uid);

        // Get ID number from userMappings
        const mappingRef = ref(database, `userMappings/${uid}`);
        const mappingSnapshot = await get(mappingRef);

        if (!mappingSnapshot.exists()) {
            console.error('User mapping not found for UID:', uid);
            throw new Error('User mapping not found. Please contact support.');
        }

        const mappingData = mappingSnapshot.val();
        currentIdNumber = mappingData.idNumber;
        console.log('Found ID number:', currentIdNumber);

        // Get full user data using ID number
        const userRef = ref(database, `users/${currentIdNumber}`);
        const userSnapshot = await get(userRef);

        if (!userSnapshot.exists()) {
            console.error('User data not found for ID:', currentIdNumber);
            throw new Error('User data not found. Please contact support.');
        }

        currentUserData = userSnapshot.val();
        console.log('User data loaded successfully:', currentUserData);

        // Verify user is a customer
        if (currentUserData.accountType !== 'customer') {
            console.error('User is not a customer:', currentUserData.accountType);
            alert('This dashboard is for customers only.');
            window.location.href = 'provider-dashboard.html';
            return;
        }

        // Display user info
        displayUserInfo(currentUserData);

        // Store in session for quick access
        sessionStorage.setItem('bongoboss_user', JSON.stringify(currentUserData));

        return currentUserData;

    } catch (error) {
        console.error('Error loading user data:', error);
        throw error;
    }
}

// Display user information in the UI
function displayUserInfo(userData) {
    console.log('Displaying user info:', userData);

    // Update user name
    const userNameElement = document.getElementById('userName');
    if (userNameElement) {
        userNameElement.textContent = userData.fullName || 'Customer';
    }

    // Update user role
    const userRoleElement = document.getElementById('userRole');
    if (userRoleElement) {
        userRoleElement.textContent = 'Customer';
    }

    // Update user avatar with first letter
    const userAvatarElement = document.getElementById('userAvatar');
    if (userAvatarElement && userData.fullName) {
        const firstLetter = userData.fullName.charAt(0).toUpperCase();
        userAvatarElement.textContent = firstLetter;
    }

    // Update page title with user name
    const pageTitleElement = document.getElementById('pageTitle');
    if (pageTitleElement) {
        const hour = new Date().getHours();
        let greeting = 'Good morning';
        if (hour >= 12 && hour < 18) greeting = 'Good afternoon';
        if (hour >= 18) greeting = 'Good evening';

        const firstName = userData.fullName ? userData.fullName.split(' ')[0] : 'there';
        pageTitleElement.textContent = `${greeting}, ${firstName}!`;
    }
}

// Load dashboard data (bookings, favorites, etc.)
async function loadDashboardData() {
    console.log('Loading dashboard data...');

    if (!currentIdNumber) {
        console.error('No ID number available');
        return;
    }

    try {
        // Load bookings
        const bookingsData = await loadBookings();

        // Load favorites
        const favoritesCount = await loadFavoritesCount();

        // Calculate and update stats
        const stats = calculateStats(bookingsData, favoritesCount);
        updateStats(stats);

        // Display upcoming bookings
        displayUpcomingBookings(bookingsData);

        // Load featured services
        await loadFeaturedServices();

        console.log('Dashboard data loaded successfully');
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        // Don't fail completely, just show empty state
        updateStats({
            totalBookings: 0,
            completedBookings: 0,
            upcomingBookings: 0,
            favoritesCount: 0
        });
    }
}

// Load bookings from Firebase
async function loadBookings() {
    try {
        console.log('Loading bookings for customer:', currentIdNumber);

        const bookingsRef = ref(database, 'bookings');
        const bookingsSnapshot = await get(bookingsRef);

        if (!bookingsSnapshot.exists()) {
            console.log('No bookings found');
            return [];
        }

        const allBookings = bookingsSnapshot.val();

        // Filter bookings for current customer
        const customerBookings = Object.keys(allBookings)
            .map(key => ({
                id: key,
                ...allBookings[key]
            }))
            .filter(booking => booking.customerId === currentIdNumber)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        console.log('Loaded bookings:', customerBookings.length);
        return customerBookings;

    } catch (error) {
        console.error('Error loading bookings:', error);
        return [];
    }
}

// Load favorites count
async function loadFavoritesCount() {
    try {
        console.log('Loading favorites for customer:', currentIdNumber);

        const favoritesRef = ref(database, `favorites/${currentIdNumber}`);
        const favoritesSnapshot = await get(favoritesRef);

        if (!favoritesSnapshot.exists()) {
            console.log('No favorites found');
            return 0;
        }

        const favoritesData = favoritesSnapshot.val();
        const count = Object.keys(favoritesData).length;
        console.log('Favorites count:', count);
        return count;

    } catch (error) {
        console.error('Error loading favorites:', error);
        return 0;
    }
}

// Calculate statistics
function calculateStats(bookings, favoritesCount) {
    const now = new Date();

    const stats = {
        totalBookings: bookings.length,
        completedBookings: bookings.filter(b => b.status === 'completed').length,
        upcomingBookings: bookings.filter(b => {
            // Count confirmed bookings with future dates or pending bookings
            if (b.status === 'confirmed' || b.status === 'pending') {
                if (b.eventDate) {
                    return new Date(b.eventDate) >= now;
                }
                return true;
            }
            return false;
        }).length,
        cancelledBookings: bookings.filter(b => b.status === 'cancelled').length,
        favoritesCount: favoritesCount
    };

    console.log('Calculated stats:', stats);
    return stats;
}

// Update statistics display
function updateStats(stats) {
    console.log('Updating stats display:', stats);

    const totalBookingsElement = document.getElementById('totalBookings');
    if (totalBookingsElement) {
        totalBookingsElement.textContent = stats.totalBookings;
    }

    const completedBookingsElement = document.getElementById('completedBookings');
    if (completedBookingsElement) {
        completedBookingsElement.textContent = stats.completedBookings;
    }

    const upcomingBookingsElement = document.getElementById('upcomingBookings');
    if (upcomingBookingsElement) {
        upcomingBookingsElement.textContent = stats.upcomingBookings;
    }

    const favoritesCountElement = document.getElementById('favoritesCount');
    if (favoritesCountElement) {
        favoritesCountElement.textContent = stats.favoritesCount;
    }
}

// Display upcoming bookings
function displayUpcomingBookings(bookings) {
    console.log('Displaying upcoming bookings:', bookings.length);

    const bookingsListElement = document.getElementById('upcomingBookingsList');
    if (!bookingsListElement) {
        console.error('Upcoming bookings list element not found');
        return;
    }

    // Clear existing content
    bookingsListElement.innerHTML = '';

    // Filter upcoming bookings
    const now = new Date();
    const upcomingBookings = bookings
        .filter(b => {
            if (b.status === 'confirmed' || b.status === 'pending') {
                if (b.eventDate) {
                    return new Date(b.eventDate) >= now;
                }
                return true;
            }
            return false;
        })
        .slice(0, 5); // Show only 5 most recent

    if (upcomingBookings.length === 0) {
        // Show empty state
        bookingsListElement.innerHTML = `
            <div class="empty-state">
                <div class="icon"><i class="fas fa-calendar-times"></i></div>
                <h3>No upcoming bookings</h3>
                <p>Browse services to make your first booking.</p>
            </div>
        `;
        return;
    }

    upcomingBookings.forEach(booking => {
        const bookingElement = createBookingElement(booking);
        bookingsListElement.appendChild(bookingElement);
    });
}

// Create booking element
function createBookingElement(booking) {
    const div = document.createElement('div');
    div.className = 'booking-item';

    const statusClass = booking.status || 'pending';
    const statusText = booking.status ? booking.status.charAt(0).toUpperCase() + booking.status.slice(1) : 'Pending';

    const eventDate = booking.eventDate ? new Date(booking.eventDate).toLocaleDateString() : 'Date TBD';

    div.innerHTML = `
        <div class="booking-header">
            <h3 class="booking-title">${booking.packageName || 'Service Booking'}</h3>
            <span class="booking-status ${statusClass}">${statusText}</span>
        </div>
        <div class="booking-info">
            <p><strong>Provider:</strong> ${booking.providerName || 'N/A'}</p>
            <p><strong>Event Date:</strong> ${eventDate}</p>
            <p><strong>Price:</strong> R ${booking.price || 0}</p>
            ${booking.location ? `<p><strong>Location:</strong> ${booking.location}</p>` : ''}
        </div>
    `;

    // Add click handler to view details
    div.style.cursor = 'pointer';
    div.onclick = () => {
        window.location.href = `my-bookings.html?id=${booking.id}`;
    };

    return div;
}

// Load featured services
async function loadFeaturedServices() {
    console.log('Loading featured services...');

    const servicesContainer = document.getElementById('featuredServices');
    if (!servicesContainer) {
        console.error('Featured services container not found');
        return;
    }

    servicesContainer.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Loading services...</p></div>';

    try {
        // Get all providers
        const usersRef = ref(database, 'users');
        const usersSnapshot = await get(usersRef);

        if (!usersSnapshot.exists()) {
            servicesContainer.innerHTML = `
                <div class="empty-state">
                    <div class="icon"><i class="fas fa-briefcase"></i></div>
                    <h3>No services available yet</h3>
                    <p>Check back soon for featured service providers.</p>
                </div>
            `;
            return;
        }

        const usersData = usersSnapshot.val();

        // Filter providers and get their service packages
        const providers = [];
        for (const [idNumber, userData] of Object.entries(usersData)) {
            if (userData.accountType === 'provider') {
                // Get provider's service packages
                const servicesRef = ref(database, `servicePackages/${idNumber}`);
                const servicesSnapshot = await get(servicesRef);

                if (servicesSnapshot.exists()) {
                    const servicesData = servicesSnapshot.val();
                    const firstService = Object.values(servicesData)[0];

                    // Get provider's portfolio for image
                    const portfolioRef = ref(database, `portfolios/${idNumber}`);
                    const portfolioSnapshot = await get(portfolioRef);
                    let imageUrl = null;

                    if (portfolioSnapshot.exists()) {
                        const portfolioData = portfolioSnapshot.val();
                        const firstPortfolio = Object.values(portfolioData)[0];
                        if (firstPortfolio.images && firstPortfolio.images.length > 0) {
                            imageUrl = firstPortfolio.images[0].data;
                        }
                    }

                    providers.push({
                        id: idNumber,
                        name: userData.fullName,
                        category: userData.serviceCategory,
                        service: firstService,
                        image: imageUrl,
                        rating: userData.rating || 4.5
                    });
                }
            }
        }

        if (providers.length === 0) {
            servicesContainer.innerHTML = `
                <div class="empty-state">
                    <div class="icon"><i class="fas fa-briefcase"></i></div>
                    <h3>No services available yet</h3>
                    <p>Check back soon for featured service providers.</p>
                </div>
            `;
            return;
        }

        // Show up to 5 random providers
        const featuredProviders = providers
            .sort(() => Math.random() - 0.5)
            .slice(0, 5);

        servicesContainer.innerHTML = '';

        featuredProviders.forEach(provider => {
            const serviceElement = createServiceElement(provider);
            servicesContainer.appendChild(serviceElement);
        });

    } catch (error) {
        console.error('Error loading featured services:', error);
        servicesContainer.innerHTML = `
            <div class="empty-state">
                <div class="icon"><i class="fas fa-exclamation-circle"></i></div>
                <h3>Error loading services</h3>
                <p>Please try refreshing the page.</p>
            </div>
        `;
    }
}

// Create service element
function createServiceElement(provider) {
    const div = document.createElement('div');
    div.className = 'service-item';

    const categoryName = getCategoryDisplayName(provider.category);

    div.innerHTML = `
        ${provider.image ? `<img src="${provider.image}" alt="${provider.name}">` : `<div class="service-placeholder"><i class="fas fa-user"></i></div>`}
        <div class="service-info">
            <h3>${provider.name}</h3>
            <p>${categoryName}</p>
        </div>
        <div class="service-rating">
            <i class="fas fa-star"></i>
            <span>${provider.rating.toFixed(1)}</span>
        </div>
    `;

    // Add click handler to view provider profile
    div.style.cursor = 'pointer';
    div.onclick = () => {
        window.location.href = `browse-services.htmml?id=${provider.id}`;
    };

    return div;
}

// Get display name for service category
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

// Toggle sidebar on mobile
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.toggle('active');
    }
}

// Handle logout
async function handleLogout() {
    console.log('Logout initiated');

    if (confirm('Are you sure you want to logout?')) {
        try {
            // Sign out from Firebase
            await signOut(auth);

            // Clear stored user data
            localStorage.removeItem('bongoboss_user');
            sessionStorage.removeItem('bongoboss_user');

            console.log('Logout successful');

            // Redirect to home page
            window.location.href = 'index.html';
        } catch (error) {
            console.error('Logout error:', error);
            alert('Error logging out. Please try again.');
        }
    }
}

// Make functions globally accessible
window.toggleSidebar = toggleSidebar;
window.handleLogout = handleLogout;

console.log('Customer dashboard script loaded successfully!');