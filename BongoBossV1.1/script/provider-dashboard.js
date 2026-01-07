// Import Firebase functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, get, child, query, orderByChild, limitToLast } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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
console.log('Initializing Provider Dashboard...');
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
    const userCategory = document.getElementById('userCategory');

    if (userName) userName.textContent = 'Loading...';
    if (userCategory) userCategory.textContent = 'Please wait...';
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

        // Verify user is a provider
        if (currentUserData.accountType !== 'provider') {
            console.error('User is not a provider:', currentUserData.accountType);
            alert('This dashboard is for service providers only.');
            window.location.href = 'index.html';
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
        userNameElement.textContent = userData.fullName || 'Provider';
    }

    // Update user category
    const userCategoryElement = document.getElementById('userCategory');
    if (userCategoryElement && userData.serviceCategory) {
        userCategoryElement.textContent = getCategoryDisplayName(userData.serviceCategory);
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

        pageTitleElement.textContent = `${greeting}, ${userData.fullName.split(' ')[0]}!`;
    }
}

// Get display name for service category
function getCategoryDisplayName(category) {
    const categoryMap = {
        'tech': 'Tech & IT Services',
        'home': 'Home Services',
        'creative': 'Creative Services',
        'business': 'Business Services',
        'health': 'Health & Wellness',
        'construction': 'Construction Workers',
        'transport': 'Moving & Transport',
        'landscaping': 'Landscaping & Gardening',
        'cleaning': 'Cleaning Services',
        'maintenance': 'Maintenance & Repair',
        'photography': 'Photography Services',
        'property': 'Real Estate Agent',
        'hotel': 'Hotel/Tourism'
    };

    return categoryMap[category] || category;
}

// Load dashboard data (bookings, stats, etc.)
async function loadDashboardData() {
    console.log('Loading dashboard data...');

    if (!currentIdNumber) {
        console.error('No ID number available');
        return;
    }

    try {
        // Load bookings
        const bookingsData = await loadBookings();

        // Load earnings (calculated from bookings)
        const earningsData = await loadEarnings();

        // Load portfolio count
        const portfolioCount = await loadPortfolioCount();

        // Calculate and update stats
        const stats = calculateStats(bookingsData, earningsData, portfolioCount);
        updateStats(stats);

        // Display recent bookings
        displayRecentBookings(bookingsData);

        console.log('Dashboard data loaded successfully');
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        // Don't fail completely, just show empty state
        updateStats({
            totalBookings: 0,
            completedBookings: 0,
            pendingBookings: 0,
            totalEarnings: 0,
            pendingEarnings: 0
        });
    }
}

// Load bookings from Firebase
async function loadBookings() {
    try {
        console.log('Loading bookings for provider:', currentIdNumber);

        const bookingsRef = ref(database, 'bookings');
        const bookingsSnapshot = await get(bookingsRef);

        if (!bookingsSnapshot.exists()) {
            console.log('No bookings found');
            return [];
        }

        const allBookings = bookingsSnapshot.val();

        // Filter bookings for current provider
        const providerBookings = Object.keys(allBookings)
            .map(key => ({
                id: key,
                ...allBookings[key]
            }))
            .filter(booking => booking.providerId === currentIdNumber)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        console.log('Loaded bookings:', providerBookings.length);
        return providerBookings;

    } catch (error) {
        console.error('Error loading bookings:', error);
        return [];
    }
}

// Load earnings from completed bookings - UPDATED VERSION
async function loadEarnings() {
    try {
        console.log('Calculating earnings from completed bookings...');

        // Get all bookings for this provider
        const bookingsRef = ref(database, 'bookings');
        const bookingsSnapshot = await get(bookingsRef);

        if (!bookingsSnapshot.exists()) {
            console.log('No bookings found');
            return { total: 0, available: 0, pending: 0 };
        }

        const allBookings = bookingsSnapshot.val();

        // Filter for this provider's bookings
        const providerBookings = Object.keys(allBookings)
            .map(key => ({
                id: key,
                ...allBookings[key]
            }))
            .filter(booking => booking.providerId === currentIdNumber);

        // Calculate earnings from completed bookings
        let totalEarnings = 0;
        let pendingEarnings = 0;

        providerBookings.forEach(booking => {
            const price = booking.servicePrice || booking.price || 0;

            if (booking.status === 'completed') {
                totalEarnings += price;
            } else if (booking.status === 'confirmed' || booking.status === 'pending') {
                pendingEarnings += price;
            }
        });

        const earningsData = {
            total: totalEarnings,
            available: totalEarnings, // All completed earnings are available
            pending: pendingEarnings
        };

        console.log('Calculated earnings:', earningsData);
        return earningsData;

    } catch (error) {
        console.error('Error calculating earnings:', error);
        return { total: 0, available: 0, pending: 0 };
    }
}

// Load portfolio count
async function loadPortfolioCount() {
    try {
        console.log('Loading portfolio count for provider:', currentIdNumber);

        const portfolioRef = ref(database, `portfolios/${currentIdNumber}`);
        const portfolioSnapshot = await get(portfolioRef);

        if (!portfolioSnapshot.exists()) {
            console.log('No portfolio items found');
            return 0;
        }

        const portfolioData = portfolioSnapshot.val();
        const count = Object.keys(portfolioData).length;
        console.log('Portfolio items count:', count);
        return count;

    } catch (error) {
        console.error('Error loading portfolio count:', error);
        return 0;
    }
}

// Calculate statistics
function calculateStats(bookings, earnings, portfolioCount) {
    const stats = {
        totalBookings: bookings.length,
        completedBookings: bookings.filter(b => b.status === 'completed').length,
        pendingBookings: bookings.filter(b => b.status === 'pending').length,
        confirmedBookings: bookings.filter(b => b.status === 'confirmed').length,
        cancelledBookings: bookings.filter(b => b.status === 'cancelled').length,
        totalEarnings: earnings.total || 0,
        availableEarnings: earnings.available || 0,
        pendingEarnings: earnings.pending || 0,
        portfolioItems: portfolioCount
    };

    console.log('Calculated stats:', stats);
    return stats;
}

// Update statistics display - UPDATED VERSION
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

    const pendingBookingsElement = document.getElementById('pendingBookings');
    if (pendingBookingsElement) {
        pendingBookingsElement.textContent = stats.pendingBookings;
    }

    const totalEarningsElement = document.getElementById('totalEarnings');
    if (totalEarningsElement) {
        // Format earnings with currency
        totalEarningsElement.textContent = `R ${stats.totalEarnings.toLocaleString('en-ZA', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    }

    // If you have a pending earnings element, update it too:
    const pendingEarningsElement = document.getElementById('pendingEarnings');
    if (pendingEarningsElement) {
        pendingEarningsElement.textContent = `R ${stats.pendingEarnings.toLocaleString('en-ZA', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    }

    // If you have an available earnings element:
    const availableEarningsElement = document.getElementById('availableEarnings');
    if (availableEarningsElement) {
        availableEarningsElement.textContent = `R ${stats.availableEarnings.toLocaleString('en-ZA', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    }
}

// Display recent bookings
function displayRecentBookings(bookings) {
    console.log('Displaying recent bookings:', bookings.length);

    const bookingsListElement = document.getElementById('bookingsList');
    if (!bookingsListElement) {
        console.error('Bookings list element not found');
        return;
    }

    // Clear existing content
    bookingsListElement.innerHTML = '';

    if (bookings.length === 0) {
        // Show empty state
        bookingsListElement.innerHTML = `
            <div class="empty-state">
                <div class="icon">📭</div>
                <h3>No bookings yet</h3>
                <p>Your bookings will appear here once customers start booking your services.</p>
            </div>
        `;
        return;
    }

    // Show only the 5 most recent bookings
    const recentBookings = bookings.slice(0, 5);

    recentBookings.forEach(booking => {
        const bookingElement = createBookingElement(booking);
        bookingsListElement.appendChild(bookingElement);
    });
}

// Create booking element - FIXED VERSION
function createBookingElement(booking) {
    const div = document.createElement('div');
    div.className = 'booking-item';

    const statusClass = booking.status || 'pending';
    const statusText = booking.status ? booking.status.charAt(0).toUpperCase() + booking.status.slice(1) : 'Pending';

    // Use bookingDate instead of eventDate (matching customer.js structure)
    const eventDate = booking.bookingDate ? new Date(booking.bookingDate).toLocaleDateString() : 'Date TBD';

    // Use servicePrice instead of price (matching customer.js structure)
    const price = booking.servicePrice || 0;

    // Use serviceName instead of packageName (matching customer.js structure)
    const serviceName = booking.serviceName || 'Service Booking';

    div.innerHTML = `
        <div class="booking-header">
            <h3 class="booking-title">${serviceName}</h3>
            <span class="booking-status ${statusClass}">${statusText}</span>
        </div>
        <div class="booking-info">
            <p><strong>Customer:</strong> ${booking.customerName || 'N/A'}</p>
            <p><strong>Date:</strong> ${eventDate}</p>
            <p><strong>Time:</strong> ${booking.bookingTime || 'TBD'}</p>
            <p><strong>Price:</strong> R ${price.toLocaleString('en-ZA', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}</p>
            ${booking.serviceLocation ? `<p><strong>Location:</strong> ${booking.serviceLocation}</p>` : ''}
        </div>
    `;

    // Add click handler to view details
    div.style.cursor = 'pointer';
    div.onclick = () => {
        window.location.href = `bookings.html?id=${booking.id}`;
    };

    return div;
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

console.log('Provider dashboard script loaded successfully!');