// Import Firebase functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, get, push, set, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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
let completedBookings = [];
let userReviews = [];
let selectedBooking = null;
let selectedRating = 0;

// Initialize on page load
window.addEventListener('load', async () => {
    console.log('Reviews page loaded');

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log('User authenticated:', user.uid);
            try {
                await loadUserData(user.uid);
                await loadReviews();
                await loadCompletedBookings();
                setupEventListeners();
                updateStats();
            } catch (error) {
                console.error('Error loading data:', error);
                alert('Please login to view reviews');
                window.location.href = '../login.html';
            }
        } else {
            console.log('No user authenticated');
            alert('Please login to view reviews');
            window.location.href = '../login.html';
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
        throw error;
    }
}

// Display user info
function displayUserInfo(userData) {
    const userNameElement = document.getElementById('userName');
    const userAvatarElement = document.getElementById('userAvatar');

    if (userNameElement) {
        userNameElement.textContent = userData.fullName || 'User';
    }

    if (userAvatarElement && userData.fullName) {
        const firstLetter = userData.fullName.charAt(0).toUpperCase();
        userAvatarElement.textContent = firstLetter;
    }
}

// Load user reviews
async function loadReviews() {
    try {
        const reviewsRef = ref(database, 'reviews');
        const reviewsSnapshot = await get(reviewsRef);

        if (!reviewsSnapshot.exists()) {
            userReviews = [];
            return;
        }

        const allReviews = reviewsSnapshot.val();

        // Filter reviews by current customer
        userReviews = Object.entries(allReviews)
            .map(([id, review]) => ({
                id,
                ...review
            }))
            .filter(review => review.customerId === currentIdNumber)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        console.log('Loaded reviews:', userReviews.length);

    } catch (error) {
        console.error('Error loading reviews:', error);
        userReviews = [];
    }
}

// Load completed bookings that haven't been reviewed
async function loadCompletedBookings() {
    try {
        const bookingsRef = ref(database, 'bookings');
        const bookingsSnapshot = await get(bookingsRef);

        if (!bookingsSnapshot.exists()) {
            displayPendingReviews([]);
            return;
        }

        const allBookings = bookingsSnapshot.val();

        // Filter completed bookings for current customer
        const completed = Object.entries(allBookings)
            .map(([id, booking]) => ({
                id,
                ...booking
            }))
            .filter(booking =>
                booking.customerId === currentIdNumber &&
                booking.status === 'completed'
            );

        // Filter out bookings that have already been reviewed
        const reviewedBookingIds = new Set(userReviews.map(r => r.bookingId));
        completedBookings = completed.filter(b => !reviewedBookingIds.has(b.id));

        console.log('Completed bookings to review:', completedBookings.length);
        displayPendingReviews(completedBookings);

    } catch (error) {
        console.error('Error loading completed bookings:', error);
        displayPendingReviews([]);
    }
}

// Display pending reviews
function displayPendingReviews(bookings) {
    const pendingList = document.getElementById('pendingReviewsList');

    if (bookings.length === 0) {
        pendingList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clipboard-check"></i>
                <h3>No pending reviews</h3>
                <p>You've reviewed all your completed services!</p>
            </div>
        `;
        return;
    }

    pendingList.innerHTML = '';

    bookings.forEach(booking => {
        const card = createPendingReviewCard(booking);
        pendingList.appendChild(card);
    });
}

// Create pending review card
function createPendingReviewCard(booking) {
    const card = document.createElement('div');
    card.className = 'review-card';

    const date = booking.bookingDate ? new Date(booking.bookingDate).toLocaleDateString('en-ZA', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    }) : 'Date not set';

    card.innerHTML = `
        <div class="review-card-header">
            <div class="service-info">
                <div class="service-name">${booking.serviceName || 'Service'}</div>
                <div class="provider-name">
                    <i class="fas fa-user"></i> ${booking.providerName || 'Provider'}
                </div>
                <span class="service-date">
                    <i class="fas fa-calendar"></i> ${date}
                </span>
            </div>
            <div class="review-action">
                <button class="btn-review" onclick="openReviewModal('${booking.id}')">
                    <i class="fas fa-star"></i> Write Review
                </button>
            </div>
        </div>
    `;

    return card;
}

// Display submitted reviews
function displaySubmittedReviews() {
    const submittedList = document.getElementById('submittedReviewsList');

    if (userReviews.length === 0) {
        submittedList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-star-half-alt"></i>
                <h3>No reviews yet</h3>
                <p>Your submitted reviews will appear here</p>
            </div>
        `;
        return;
    }

    submittedList.innerHTML = '';

    userReviews.forEach(review => {
        const card = createSubmittedReviewCard(review);
        submittedList.appendChild(card);
    });
}

// Create submitted review card
function createSubmittedReviewCard(review) {
    const card = document.createElement('div');
    card.className = 'submitted-review-card';
    card.onclick = () => viewReviewDetails(review);

    const stars = Array.from({ length: 5 }, (_, i) => {
        const isFilled = i < review.rating;
        return `<i class="fas fa-star ${isFilled ? '' : 'empty'}"></i>`;
    }).join('');

    const date = new Date(review.createdAt).toLocaleDateString('en-ZA', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });

    card.innerHTML = `
        <div class="review-header">
            <div class="review-rating">${stars}</div>
            <div class="review-date">${date}</div>
        </div>
        <div class="review-title">${review.title || 'Review'}</div>
        <div class="review-content">${review.review}</div>
        <div class="review-footer">
            <div class="reviewed-service">
                <strong>${review.serviceName}</strong> by ${review.providerName}
            </div>
        </div>
    `;

    return card;
}

// Open review modal
function openReviewModal(bookingId) {
    selectedBooking = completedBookings.find(b => b.id === bookingId);
    if (!selectedBooking) return;

    selectedRating = 0;
    updateStarRating(0);

    // Reset form
    document.getElementById('reviewTitle').value = '';
    document.getElementById('reviewText').value = '';
    document.getElementById('charCount').textContent = '0';

    // Populate service info
    document.getElementById('reviewServiceName').textContent = selectedBooking.serviceName || 'Service';
    document.getElementById('reviewProviderName').textContent = selectedBooking.providerName || 'Provider';

    const date = selectedBooking.bookingDate ? new Date(selectedBooking.bookingDate).toLocaleDateString('en-ZA', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    }) : 'Date not set';
    document.getElementById('reviewServiceDate').textContent = date;

    // Show modal
    document.getElementById('reviewModal').classList.add('active');
}

// Close review modal
function closeReviewModal() {
    document.getElementById('reviewModal').classList.remove('active');
    selectedBooking = null;
    selectedRating = 0;
}

// View review details
function viewReviewDetails(review) {
    const modal = document.getElementById('viewReviewModal');
    const modalBody = document.getElementById('viewReviewBody');

    const stars = Array.from({ length: 5 }, (_, i) => {
        const isFilled = i < review.rating;
        return `<i class="fas fa-star ${isFilled ? '' : 'empty'}"></i>`;
    }).join('');

    const date = new Date(review.createdAt).toLocaleDateString('en-ZA', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    modalBody.innerHTML = `
        <div class="review-detail-content">
            <div class="detail-rating">
                <div class="stars">${stars}</div>
                <div class="rating-value">${review.rating}.0/5</div>
            </div>

            <div class="detail-section">
                <h4>Service</h4>
                <p><strong>${review.serviceName}</strong> by ${review.providerName}</p>
            </div>

            ${review.title ? `
                <div class="detail-section">
                    <h4>Review Title</h4>
                    <p><strong>${review.title}</strong></p>
                </div>
            ` : ''}

            <div class="detail-section">
                <h4>Your Review</h4>
                <p>${review.review}</p>
            </div>

            <div class="detail-section">
                <h4>Submitted</h4>
                <p>${date}</p>
            </div>
        </div>
    `;

    modal.classList.add('active');
}

// Close view review modal
function closeViewReviewModal() {
    document.getElementById('viewReviewModal').classList.remove('active');
}

// Submit review
async function submitReview() {
    if (!selectedBooking) return;

    const title = document.getElementById('reviewTitle').value.trim();
    const reviewText = document.getElementById('reviewText').value.trim();

    // Validation
    if (selectedRating === 0) {
        alert('Please select a rating');
        return;
    }

    if (!reviewText) {
        alert('Please write a review');
        return;
    }

    const submitBtn = document.getElementById('submitReviewBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

    try {
        const reviewsRef = ref(database, 'reviews');
        const newReviewRef = push(reviewsRef);

        const reviewData = {
            bookingId: selectedBooking.id,
            customerId: currentIdNumber,
            customerName: currentUser.fullName,
            providerId: selectedBooking.providerId,
            providerName: selectedBooking.providerName,
            serviceName: selectedBooking.serviceName,
            rating: selectedRating,
            title: title,
            review: reviewText,
            createdAt: new Date().toISOString(),
            status: 'published'
        };

        await set(newReviewRef, reviewData);

        // Update provider's average rating
        await updateProviderRating(selectedBooking.providerId);

        alert('Review submitted successfully!');
        closeReviewModal();

        // Reload data
        await loadReviews();
        await loadCompletedBookings();
        updateStats();

    } catch (error) {
        console.error('Error submitting review:', error);
        alert('Failed to submit review. Please try again.');

        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Review';
    }
}

// Update provider rating
async function updateProviderRating(providerId) {
    try {
        const reviewsRef = ref(database, 'reviews');
        const reviewsSnapshot = await get(reviewsRef);

        if (!reviewsSnapshot.exists()) return;

        const allReviews = reviewsSnapshot.val();

        // Filter reviews for this provider
        const providerReviews = Object.values(allReviews)
            .filter(review => review.providerId === providerId);

        if (providerReviews.length === 0) return;

        // Calculate average rating
        const totalRating = providerReviews.reduce((sum, review) => sum + review.rating, 0);
        const averageRating = (totalRating / providerReviews.length).toFixed(1);

        // Update provider's rating
        const providerRef = ref(database, `users/${providerId}`);
        await update(providerRef, {
            averageRating: parseFloat(averageRating),
            totalReviews: providerReviews.length,
            updatedAt: new Date().toISOString()
        });

        console.log(`Updated provider ${providerId} rating to ${averageRating}`);

    } catch (error) {
        console.error('Error updating provider rating:', error);
    }
}

// Update statistics
function updateStats() {
    const totalReviewsEl = document.getElementById('totalReviews');
    const pendingReviewsEl = document.getElementById('pendingReviews');
    const averageRatingEl = document.getElementById('averageRating');

    totalReviewsEl.textContent = userReviews.length;
    pendingReviewsEl.textContent = completedBookings.length;

    // Calculate average rating
    if (userReviews.length > 0) {
        const totalRating = userReviews.reduce((sum, review) => sum + review.rating, 0);
        const avgRating = (totalRating / userReviews.length).toFixed(1);
        averageRatingEl.textContent = avgRating;
    } else {
        averageRatingEl.textContent = '0.0';
    }
}

// Setup event listeners
function setupEventListeners() {
    // Filter tabs
    const filterTabs = document.querySelectorAll('.filter-tab');
    filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const filter = tab.getAttribute('data-filter');
            switchFilter(filter);
        });
    });

    // Star rating
    const stars = document.querySelectorAll('#starRating i');
    stars.forEach(star => {
        star.addEventListener('click', () => {
            const rating = parseInt(star.getAttribute('data-rating'));
            selectedRating = rating;
            updateStarRating(rating);
        });

        star.addEventListener('mouseenter', () => {
            const rating = parseInt(star.getAttribute('data-rating'));
            highlightStars(rating);
        });
    });

    document.getElementById('starRating').addEventListener('mouseleave', () => {
        updateStarRating(selectedRating);
    });

    // Character counter
    const reviewTextArea = document.getElementById('reviewText');
    reviewTextArea.addEventListener('input', () => {
        const count = reviewTextArea.value.length;
        document.getElementById('charCount').textContent = count;
    });

    // Display submitted reviews initially in the second tab
    displaySubmittedReviews();
}

// Switch filter
function switchFilter(filter) {
    // Update tabs
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.getAttribute('data-filter') === filter) {
            tab.classList.add('active');
        }
    });

    // Update sections
    if (filter === 'pending') {
        document.getElementById('pendingSection').classList.add('active');
        document.getElementById('submittedSection').classList.remove('active');
        document.getElementById('pendingSection').style.display = 'block';
        document.getElementById('submittedSection').style.display = 'none';
    } else {
        document.getElementById('pendingSection').classList.remove('active');
        document.getElementById('submittedSection').classList.add('active');
        document.getElementById('pendingSection').style.display = 'none';
        document.getElementById('submittedSection').style.display = 'block';
        displaySubmittedReviews();
    }
}

// Update star rating display
function updateStarRating(rating) {
    const stars = document.querySelectorAll('#starRating i');
    const ratingText = document.getElementById('ratingText');

    stars.forEach((star, index) => {
        if (index < rating) {
            star.classList.add('active');
        } else {
            star.classList.remove('active');
        }
    });

    const ratingLabels = ['Select a rating', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
    ratingText.textContent = ratingLabels[rating];
}

// Highlight stars on hover
function highlightStars(rating) {
    const stars = document.querySelectorAll('#starRating i');
    stars.forEach((star, index) => {
        if (index < rating) {
            star.classList.add('active');
        } else {
            star.classList.remove('active');
        }
    });
}

// Toggle sidebar
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
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

// Make functions globally accessible
window.toggleSidebar = toggleSidebar;
window.handleLogout = handleLogout;
window.openReviewModal = openReviewModal;
window.closeReviewModal = closeReviewModal;
window.closeViewReviewModal = closeViewReviewModal;
window.submitReview = submitReview;

console.log('Reviews page script loaded successfully!');