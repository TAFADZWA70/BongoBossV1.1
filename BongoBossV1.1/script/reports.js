// Import Firebase functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, get, update, push, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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
let allBookings = [];
let allReviews = [];
let currentPeriod = 'month';
let selectedCustomerId = null;
let selectedBookingId = null;
let selectedRating = 0;

// Initialize on page load
window.addEventListener('load', () => {
    console.log('Reports page loaded');

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log('User authenticated:', user.uid);
            await loadUserData(user.uid);
            await loadData();
            setupPeriodSelector();
            setupStarRating();
        } else {
            console.log('No user authenticated');
            window.location.href = '../../login.html';
        }
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

        currentIdNumber = mappingSnapshot.val().idNumber;

        const userRef = ref(database, `users/${currentIdNumber}`);
        const userSnapshot = await get(userRef);

        if (!userSnapshot.exists()) {
            throw new Error('User data not found');
        }

        currentUser = userSnapshot.val();
        displayUserInfo(currentUser);

    } catch (error) {
        console.error('Error loading user data:', error);
        throw error;
    }
}

// Display user info
function displayUserInfo(userData) {
    const userName = document.getElementById('userName');
    const userCategory = document.getElementById('userCategory');
    const userAvatar = document.getElementById('userAvatar');

    if (userName) {
        userName.textContent = userData.fullName || 'Provider';
    }

    if (userCategory) {
        userCategory.textContent = userData.serviceCategory || 'Service Provider';
    }

    if (userAvatar && userData.fullName) {
        userAvatar.textContent = userData.fullName.charAt(0).toUpperCase();
    }
}

// Load all data
async function loadData() {
    try {
        await Promise.all([
            loadBookings(),
            loadReviews()
        ]);
        updateStats();
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// Load bookings
async function loadBookings() {
    try {
        const bookingsRef = ref(database, 'bookings');
        const snapshot = await get(bookingsRef);

        if (snapshot.exists()) {
            const data = snapshot.val();
            allBookings = Object.keys(data)
                .map(key => ({ id: key, ...data[key] }))
                .filter(b => b.providerId === currentIdNumber)
                .sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt));

            console.log('Loaded bookings:', allBookings.length);
            displayTransactions(filterByPeriod(allBookings));
        } else {
            displayEmptyTransactions();
        }
    } catch (error) {
        console.error('Error loading bookings:', error);
        displayEmptyTransactions();
    }
}

// Load reviews
async function loadReviews() {
    try {
        const reviewsRef = ref(database, 'reviews');
        const snapshot = await get(reviewsRef);

        if (snapshot.exists()) {
            const data = snapshot.val();
            allReviews = Object.keys(data)
                .map(key => ({ id: key, ...data[key] }))
                .filter(r => r.providerId === currentIdNumber)
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            console.log('Loaded reviews:', allReviews.length);
            displayReviews(allReviews);
        } else {
            displayEmptyReviews();
        }
    } catch (error) {
        console.error('Error loading reviews:', error);
        displayEmptyReviews();
    }
}

// Filter data by period
function filterByPeriod(data) {
    const now = new Date();
    let startDate;

    switch (currentPeriod) {
        case 'week':
            startDate = new Date(now.setDate(now.getDate() - 7));
            break;
        case 'month':
            startDate = new Date(now.setMonth(now.getMonth() - 1));
            break;
        case 'year':
            startDate = new Date(now.setFullYear(now.getFullYear() - 1));
            break;
        case 'all':
            return data;
        default:
            startDate = new Date(now.setMonth(now.getMonth() - 1));
    }

    return data.filter(item => {
        const itemDate = new Date(item.completedAt || item.createdAt);
        return itemDate >= startDate;
    });
}

// Update statistics
function updateStats() {
    const filteredBookings = filterByPeriod(allBookings);
    const completedBookings = filteredBookings.filter(b => b.status === 'completed');
    const pendingBookings = filteredBookings.filter(b => b.status === 'confirmed');

    // Calculate total earnings
    const totalEarnings = completedBookings.reduce((sum, b) => sum + (b.servicePrice || 0), 0);
    document.getElementById('totalEarnings').textContent = totalEarnings.toLocaleString();

    // Completed services
    document.getElementById('completedServices').textContent = completedBookings.length;

    // Average rating
    if (allReviews.length > 0) {
        const avgRating = allReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / allReviews.length;
        document.getElementById('averageRating').textContent = avgRating.toFixed(1);
    } else {
        document.getElementById('averageRating').textContent = '0.0';
    }
    document.getElementById('totalReviews').textContent = allReviews.length;

    // Pending payments
    const pendingPayments = pendingBookings.reduce((sum, b) => sum + (b.servicePrice || 0), 0);
    document.getElementById('pendingPayments').textContent = pendingPayments.toLocaleString();
    document.getElementById('pendingCount').textContent = pendingBookings.length;

    // Calculate percentage changes (mock data for now)
    document.getElementById('earningsChange').textContent = '12.5%';
    document.getElementById('servicesChange').textContent = '8.3%';
}

// Display transactions
function displayTransactions(bookings) {
    const tbody = document.getElementById('transactionsBody');
    tbody.innerHTML = '';

    if (bookings.length === 0) {
        displayEmptyTransactions();
        return;
    }

    bookings.forEach(booking => {
        const row = document.createElement('tr');
        const date = new Date(booking.completedAt || booking.createdAt).toLocaleDateString('en-ZA');
        const status = booking.status || 'pending';

        row.innerHTML = `
            <td>${date}</td>
            <td>${booking.serviceName || 'Service'}</td>
            <td>${booking.customerName || 'Customer'}</td>
            <td>R ${(booking.servicePrice || 0).toLocaleString()}</td>
            <td><span class="transaction-status ${status}">${status}</span></td>
        `;

        tbody.appendChild(row);
    });
}

// Display empty transactions
function displayEmptyTransactions() {
    const tbody = document.getElementById('transactionsBody');
    tbody.innerHTML = `
        <tr>
            <td colspan="5">
                <div class="empty-state">
                    <i class="fas fa-receipt"></i>
                    <h3>No transactions yet</h3>
                    <p>Your earnings history will appear here.</p>
                </div>
            </td>
        </tr>
    `;
}

// Display reviews
function displayReviews(reviews) {
    const container = document.getElementById('reviewsContainer');
    container.innerHTML = '';

    if (reviews.length === 0) {
        displayEmptyReviews();
        return;
    }

    reviews.slice(0, 10).forEach(review => {
        const card = createReviewCard(review);
        container.appendChild(card);
    });
}

// Create review card
function createReviewCard(review) {
    const card = document.createElement('div');
    card.className = 'review-card';

    const customerName = review.customerName || 'Customer';
    const customerInitial = customerName.charAt(0).toUpperCase();
    const rating = review.rating || 0;
    const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
    const reviewText = review.review || 'No review text provided.';
    const date = new Date(review.createdAt).toLocaleDateString('en-ZA');

    // Check if provider has already rated this customer
    const hasRated = review.providerRating !== undefined;

    card.innerHTML = `
        <div class="review-header">
            <div class="customer-info">
                <div class="customer-avatar">${customerInitial}</div>
                <div class="customer-details">
                    <h4>${customerName}</h4>
                    <p>${review.serviceName || 'Service'}</p>
                </div>
            </div>
            <div class="rating-stars">${stars}</div>
        </div>
        <div class="review-text">${reviewText}</div>
        <div class="review-footer">
            <span class="review-date">${date}</span>
            <button class="rate-customer-btn" 
                    onclick="openRatingModal('${review.customerId}', '${customerName}', '${review.id}')"
                    ${hasRated ? 'disabled' : ''}>
                <i class="fas fa-star"></i> ${hasRated ? 'Already Rated' : 'Rate Customer'}
            </button>
        </div>
    `;

    return card;
}

// Display empty reviews
function displayEmptyReviews() {
    const container = document.getElementById('reviewsContainer');
    container.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-star"></i>
            <h3>No reviews yet</h3>
            <p>Customer reviews will appear here once you complete services.</p>
        </div>
    `;
}

// Setup period selector
function setupPeriodSelector() {
    const periodBtns = document.querySelectorAll('.period-btn');

    periodBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            periodBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            currentPeriod = btn.getAttribute('data-period');
            displayTransactions(filterByPeriod(allBookings));
            updateStats();
        });
    });
}

// Setup star rating
function setupStarRating() {
    const stars = document.querySelectorAll('.star');

    stars.forEach(star => {
        star.addEventListener('click', () => {
            selectedRating = parseInt(star.getAttribute('data-rating'));
            updateStarDisplay();
        });

        star.addEventListener('mouseenter', () => {
            const rating = parseInt(star.getAttribute('data-rating'));
            highlightStars(rating);
        });
    });

    document.getElementById('starRating').addEventListener('mouseleave', () => {
        updateStarDisplay();
    });
}

// Highlight stars
function highlightStars(rating) {
    const stars = document.querySelectorAll('.star');
    stars.forEach((star, index) => {
        if (index < rating) {
            star.classList.add('active');
        } else {
            star.classList.remove('active');
        }
    });
}

// Update star display
function updateStarDisplay() {
    highlightStars(selectedRating);
}

// Open rating modal
function openRatingModal(customerId, customerName, reviewId) {
    selectedCustomerId = customerId;
    selectedBookingId = reviewId;
    selectedRating = 0;

    document.getElementById('customerNameModal').textContent = `Rate your experience with ${customerName}`;
    document.getElementById('reviewText').value = '';

    const stars = document.querySelectorAll('.star');
    stars.forEach(star => star.classList.remove('active'));

    document.getElementById('ratingModal').classList.add('active');
}

// Close rating modal
function closeRatingModal() {
    selectedCustomerId = null;
    selectedBookingId = null;
    selectedRating = 0;
    document.getElementById('ratingModal').classList.remove('active');
}

// Submit customer rating
async function submitCustomerRating() {
    if (selectedRating === 0) {
        alert('Please select a rating');
        return;
    }

    if (!selectedCustomerId || !selectedBookingId) {
        alert('Invalid rating data');
        return;
    }

    const reviewText = document.getElementById('reviewText').value.trim();
    const submitBtn = document.getElementById('submitRatingBtn');

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

    try {
        // Update the review with provider's rating
        const reviewRef = ref(database, `reviews/${selectedBookingId}`);
        await update(reviewRef, {
            providerRating: selectedRating,
            providerReview: reviewText,
            providerRatedAt: new Date().toISOString()
        });

        // Also create a customer rating entry
        const customerRatingsRef = ref(database, 'customerRatings');
        const newRatingRef = push(customerRatingsRef);
        await set(newRatingRef, {
            customerId: selectedCustomerId,
            providerId: currentIdNumber,
            providerName: currentUser.fullName,
            rating: selectedRating,
            review: reviewText,
            createdAt: new Date().toISOString()
        });

        alert('Customer rated successfully!');
        closeRatingModal();

        // Reload reviews
        await loadReviews();

    } catch (error) {
        console.error('Error submitting rating:', error);
        alert('Error submitting rating. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Submit Rating';
    }
}

// Export transactions
function exportTransactions() {
    const filteredBookings = filterByPeriod(allBookings);

    if (filteredBookings.length === 0) {
        alert('No transactions to export');
        return;
    }

    // Create CSV content
    let csv = 'Date,Service,Customer,Amount,Status\n';

    filteredBookings.forEach(booking => {
        const date = new Date(booking.completedAt || booking.createdAt).toLocaleDateString('en-ZA');
        const service = booking.serviceName || 'Service';
        const customer = booking.customerName || 'Customer';
        const amount = booking.servicePrice || 0;
        const status = booking.status || 'pending';

        csv += `${date},"${service}","${customer}",${amount},${status}\n`;
    });

    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bongoboss_earnings_${currentPeriod}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

// Handle logout
async function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        try {
            await signOut(auth);
            localStorage.removeItem('bongoboss_user');
            sessionStorage.removeItem('bongoboss_user');
            window.location.href = '../../index.html';
        } catch (error) {
            console.error('Logout error:', error);
            alert('Error logging out. Please try again.');
        }
    }
}

// Make functions globally accessible
window.openRatingModal = openRatingModal;
window.closeRatingModal = closeRatingModal;
window.submitCustomerRating = submitCustomerRating;
window.exportTransactions = exportTransactions;
window.handleLogout = handleLogout;

console.log('Reports page script loaded successfully!');