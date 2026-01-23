// Import Firebase functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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
let providerReviews = [];
let currentFilter = 'all';

// Initialize on page load
window.addEventListener('load', async () => {
    console.log('Provider Reviews page loaded');

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log('User authenticated:', user.uid);
            try {
                await loadUserData(user.uid);
                await loadProviderReviews();
                setupEventListeners();
                updateStats();
                updateRatingBreakdown();
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

        // Verify this is a provider account
        if (currentUser.accountType !== 'provider') {
            alert('This page is only accessible to service providers.');
            window.location.href = '../index.html';
            return;
        }

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
        userNameElement.textContent = userData.fullName || 'Provider';
    }

    if (userAvatarElement && userData.fullName) {
        const firstLetter = userData.fullName.charAt(0).toUpperCase();
        userAvatarElement.textContent = firstLetter;
    }
}

// Load provider reviews
async function loadProviderReviews() {
    try {
        const reviewsRef = ref(database, 'reviews');
        const reviewsSnapshot = await get(reviewsRef);

        if (!reviewsSnapshot.exists()) {
            providerReviews = [];
            displayReviews([]);
            return;
        }

        const allReviews = reviewsSnapshot.val();

        // Filter reviews for current provider
        providerReviews = Object.entries(allReviews)
            .map(([id, review]) => ({
                id,
                ...review
            }))
            .filter(review => review.providerId === currentIdNumber)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        console.log('Loaded provider reviews:', providerReviews.length);
        displayReviews(providerReviews);

    } catch (error) {
        console.error('Error loading reviews:', error);
        providerReviews = [];
        displayReviews([]);
    }
}

// Display reviews based on current filter
function displayReviews(reviews) {
    const reviewsList = document.getElementById('reviewsList');

    if (reviews.length === 0) {
        reviewsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-star-half-alt"></i>
                <h3>No reviews yet</h3>
                <p>Customer reviews will appear here once you complete bookings</p>
            </div>
        `;
        return;
    }

    reviewsList.innerHTML = '';

    reviews.forEach(review => {
        const card = createReviewCard(review);
        reviewsList.appendChild(card);
    });
}

// Create review card
function createReviewCard(review) {
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

    // Truncate review text if too long
    const reviewText = review.review.length > 150
        ? review.review.substring(0, 150) + '...'
        : review.review;

    card.innerHTML = `
        <div class="review-header">
            <div class="review-rating">${stars}</div>
            <div class="review-date">${date}</div>
        </div>
        ${review.title ? `<div class="review-title">${review.title}</div>` : ''}
        <div class="review-content">${reviewText}</div>
        <div class="review-footer">
            <div class="reviewed-service">
                <i class="fas fa-user"></i> ${review.customerName || 'Customer'}
                ${review.serviceName ? ` • <strong>${review.serviceName}</strong>` : ''}
            </div>
        </div>
    `;

    return card;
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
                <h4>Customer</h4>
                <p><strong>${review.customerName || 'Anonymous'}</strong></p>
            </div>

            ${review.serviceName ? `
                <div class="detail-section">
                    <h4>Service</h4>
                    <p><strong>${review.serviceName}</strong></p>
                </div>
            ` : ''}

            ${review.title ? `
                <div class="detail-section">
                    <h4>Review Title</h4>
                    <p><strong>${review.title}</strong></p>
                </div>
            ` : ''}

            <div class="detail-section">
                <h4>Customer Feedback</h4>
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

// Update statistics
function updateStats() {
    const totalReviewsEl = document.getElementById('totalReviews');
    const averageRatingEl = document.getElementById('averageRating');
    const fiveStarReviewsEl = document.getElementById('fiveStarReviews');

    totalReviewsEl.textContent = providerReviews.length;

    // Calculate average rating
    if (providerReviews.length > 0) {
        const totalRating = providerReviews.reduce((sum, review) => sum + review.rating, 0);
        const avgRating = (totalRating / providerReviews.length).toFixed(1);
        averageRatingEl.textContent = avgRating;

        // Count 5-star reviews
        const fiveStarCount = providerReviews.filter(r => r.rating === 5).length;
        fiveStarReviewsEl.textContent = fiveStarCount;
    } else {
        averageRatingEl.textContent = '0.0';
        fiveStarReviewsEl.textContent = '0';
    }
}

// Update rating breakdown
function updateRatingBreakdown() {
    const overallRatingEl = document.getElementById('overallRating');
    const overallStarsEl = document.getElementById('overallStars');
    const ratingCountEl = document.getElementById('ratingCount');

    if (providerReviews.length === 0) {
        overallRatingEl.textContent = '0.0';
        ratingCountEl.textContent = '0 reviews';
        overallStarsEl.innerHTML = Array(5).fill('<i class="fas fa-star empty"></i>').join('');
        return;
    }

    // Calculate overall rating
    const totalRating = providerReviews.reduce((sum, review) => sum + review.rating, 0);
    const avgRating = (totalRating / providerReviews.length).toFixed(1);
    overallRatingEl.textContent = avgRating;
    ratingCountEl.textContent = `${providerReviews.length} review${providerReviews.length !== 1 ? 's' : ''}`;

    // Update overall stars
    const fullStars = Math.floor(avgRating);
    const hasHalfStar = avgRating % 1 >= 0.5;
    let starsHTML = '';

    for (let i = 0; i < 5; i++) {
        if (i < fullStars) {
            starsHTML += '<i class="fas fa-star"></i>';
        } else if (i === fullStars && hasHalfStar) {
            starsHTML += '<i class="fas fa-star-half-alt"></i>';
        } else {
            starsHTML += '<i class="fas fa-star empty"></i>';
        }
    }
    overallStarsEl.innerHTML = starsHTML;

    // Calculate rating distribution
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    providerReviews.forEach(review => {
        distribution[review.rating]++;
    });

    // Update bars
    for (let i = 1; i <= 5; i++) {
        const count = distribution[i];
        const percentage = providerReviews.length > 0 ? (count / providerReviews.length) * 100 : 0;

        const barEl = document.getElementById(`bar${i}`);
        const countEl = document.getElementById(`count${i}`);

        if (barEl) barEl.style.width = `${percentage}%`;
        if (countEl) countEl.textContent = count;
    }
}

// Filter reviews
function filterReviews(filter) {
    currentFilter = filter;
    let filtered = [...providerReviews];

    switch (filter) {
        case 'recent':
            // Already sorted by date (newest first)
            filtered = filtered.slice(0, 10); // Show last 10
            break;
        case 'high':
            filtered = filtered.filter(r => r.rating >= 4);
            break;
        case 'low':
            filtered = filtered.filter(r => r.rating <= 2);
            break;
        case 'all':
        default:
            // Show all reviews
            break;
    }

    displayReviews(filtered);
}

// Setup event listeners
function setupEventListeners() {
    // Filter tabs
    const filterTabs = document.querySelectorAll('.filter-tab');
    filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const filter = tab.getAttribute('data-filter');

            // Update active tab
            filterTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Filter reviews
            filterReviews(filter);
        });
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
            window.location.href = '../index.html';
        } catch (error) {
            console.error('Logout error:', error);
            alert('Error logging out. Please try again.');
        }
    }
}

// Make functions globally accessible
window.toggleSidebar = toggleSidebar;
window.handleLogout = handleLogout;
window.closeViewReviewModal = closeViewReviewModal;

console.log('Provider Reviews page script loaded successfully!');