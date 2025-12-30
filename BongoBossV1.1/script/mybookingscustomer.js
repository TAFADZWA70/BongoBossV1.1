// Import Firebase functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, get, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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
let currentFilter = 'all';
let selectedBookingId = null;

// Initialize on page load
window.addEventListener('load', async () => {
    console.log('My Bookings page loaded');

    // Check authentication
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log('User authenticated:', user.uid);
            try {
                await loadUserData(user.uid);
                await loadBookings();
                setupFilterTabs();
            } catch (error) {
                console.error('Error loading data:', error);
                alert('Please login to view your bookings');
                window.location.href = '../login.html';
            }
        } else {
            console.log('No user authenticated');
            alert('Please login to view your bookings');
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

// Load bookings
async function loadBookings() {
    try {
        console.log('Loading bookings for customer:', currentIdNumber);

        const bookingsRef = ref(database, 'bookings');
        const bookingsSnapshot = await get(bookingsRef);

        if (!bookingsSnapshot.exists()) {
            displayEmptyState();
            return;
        }

        const allBookingsData = bookingsSnapshot.val();

        // Filter bookings for current customer
        allBookings = Object.keys(allBookingsData)
            .map(key => ({
                id: key,
                ...allBookingsData[key]
            }))
            .filter(booking => booking.customerId === currentIdNumber)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        console.log('Loaded bookings:', allBookings.length);

        if (allBookings.length === 0) {
            displayEmptyState();
        } else {
            displayBookings(allBookings);
        }

    } catch (error) {
        console.error('Error loading bookings:', error);
        displayError();
    }
}

// Display bookings
function displayBookings(bookings) {
    const bookingsGrid = document.getElementById('bookingsGrid');
    bookingsGrid.innerHTML = '';

    if (bookings.length === 0) {
        displayEmptyState();
        return;
    }

    bookings.forEach(booking => {
        const bookingCard = createBookingCard(booking);
        bookingsGrid.appendChild(bookingCard);
    });
}

// Create booking card
function createBookingCard(booking) {
    const card = document.createElement('div');
    card.className = 'booking-card';

    const statusClass = booking.status || 'pending';
    const serviceName = booking.serviceName || 'Service Booking';
    const providerName = booking.providerName || 'Provider';
    const price = booking.servicePrice || 0;
    const date = booking.bookingDate ? new Date(booking.bookingDate).toLocaleDateString() : 'Date TBD';
    const time = booking.bookingTime || 'TBD';

    card.innerHTML = `
        <div class="booking-header">
            <h3 class="booking-title">${serviceName}</h3>
            <span class="booking-status ${statusClass}">${statusClass}</span>
        </div>
        <div class="booking-info">
            <div class="info-row">
                <i class="fas fa-user"></i>
                <span><strong>Provider:</strong> ${providerName}</span>
            </div>
            <div class="info-row">
                <i class="fas fa-calendar"></i>
                <span><strong>Date:</strong> ${date}</span>
            </div>
            <div class="info-row">
                <i class="fas fa-clock"></i>
                <span><strong>Time:</strong> ${time}</span>
            </div>
            <div class="info-row">
                <i class="fas fa-location-dot"></i>
                <span><strong>Location:</strong> ${booking.serviceLocation || 'N/A'}</span>
            </div>
        </div>
        <div class="booking-price">R ${price.toLocaleString()}</div>
        <div class="booking-actions">
            <button class="btn-action btn-view" onclick="viewBookingDetails('${booking.id}')">
                <i class="fas fa-eye"></i> View Details
            </button>
            ${booking.status === 'pending' || booking.status === 'confirmed' ? `
                <button class="btn-action btn-cancel" onclick="openCancelModal('${booking.id}')">
                    <i class="fas fa-times"></i> Cancel
                </button>
            ` : ''}
        </div>
    `;

    return card;
}

// View booking details
function viewBookingDetails(bookingId) {
    const booking = allBookings.find(b => b.id === bookingId);
    if (!booking) return;

    const modal = document.getElementById('bookingModal');
    const modalBody = document.getElementById('modalBody');

    const statusClass = booking.status || 'pending';
    const serviceName = booking.serviceName || 'Service Booking';
    const providerName = booking.providerName || 'Provider';
    const price = booking.servicePrice || 0;
    const date = booking.bookingDate ? new Date(booking.bookingDate).toLocaleDateString('en-ZA', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }) : 'Date TBD';
    const time = booking.bookingTime || 'TBD';

    modalBody.innerHTML = `
        <div class="modal-header">
            <span class="modal-status-badge booking-status ${statusClass}">${statusClass}</span>
            <h2>${serviceName}</h2>
            <p>Booking Reference: <strong>${booking.id}</strong></p>
        </div>

        <div class="modal-section">
            <h3><i class="fas fa-user"></i> Provider Information</h3>
            <div class="detail-grid">
                <div class="detail-item">
                    <span class="detail-label">Provider Name</span>
                    <span class="detail-value">${providerName}</span>
                </div>
                ${booking.providerEmail ? `
                    <div class="detail-item">
                        <span class="detail-label">Email</span>
                        <span class="detail-value">${booking.providerEmail}</span>
                    </div>
                ` : ''}
            </div>
        </div>

        <div class="modal-section">
            <h3><i class="fas fa-calendar-check"></i> Booking Details</h3>
            <div class="detail-grid">
                <div class="detail-item">
                    <span class="detail-label">Service Date</span>
                    <span class="detail-value">${date}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Service Time</span>
                    <span class="detail-value">${time}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Location</span>
                    <span class="detail-value">${booking.serviceLocation || 'N/A'}</span>
                </div>
                ${booking.customerPhone ? `
                    <div class="detail-item">
                        <span class="detail-label">Contact Phone</span>
                        <span class="detail-value">${booking.customerPhone}</span>
                    </div>
                ` : ''}
            </div>
            ${booking.additionalNotes ? `
                <div class="detail-item" style="margin-top: 1rem;">
                    <span class="detail-label">Additional Notes</span>
                    <span class="detail-value">${booking.additionalNotes}</span>
                </div>
            ` : ''}
        </div>

        <div class="modal-section">
            <h3><i class="fas fa-dollar-sign"></i> Payment Information</h3>
            <div class="price-detail">
                <span class="detail-label">Total Amount</span>
                <span class="detail-value">R ${price.toLocaleString()}</span>
            </div>
        </div>

        <div class="modal-actions">
            <button class="btn-secondary" onclick="closeModal()">
                <i class="fas fa-times"></i> Close
            </button>
            ${booking.status === 'pending' || booking.status === 'confirmed' ? `
                <button class="btn-danger" onclick="openCancelModal('${booking.id}')">
                    <i class="fas fa-ban"></i> Cancel Booking
                </button>
            ` : ''}
        </div>
    `;

    modal.classList.add('active');
}

// Open cancel modal
function openCancelModal(bookingId) {
    selectedBookingId = bookingId;
    closeModal();
    document.getElementById('cancelModal').classList.add('active');
}

// Close cancel modal
function closeCancelModal() {
    selectedBookingId = null;
    document.getElementById('cancelReason').value = '';
    document.getElementById('cancelModal').classList.remove('active');
}

// Confirm cancellation
async function confirmCancellation() {
    if (!selectedBookingId) return;

    const reason = document.getElementById('cancelReason').value;
    const confirmBtn = document.querySelector('.btn-danger');

    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cancelling...';

    try {
        const bookingRef = ref(database, `bookings/${selectedBookingId}`);
        await update(bookingRef, {
            status: 'cancelled',
            cancellationReason: reason || 'No reason provided',
            cancelledBy: 'customer',
            cancelledAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        // Update local data
        const bookingIndex = allBookings.findIndex(b => b.id === selectedBookingId);
        if (bookingIndex !== -1) {
            allBookings[bookingIndex].status = 'cancelled';
        }

        closeCancelModal();
        await loadBookings();
        filterBookings(currentFilter);

        alert('Booking cancelled successfully');

    } catch (error) {
        console.error('Error cancelling booking:', error);
        alert('Error cancelling booking. Please try again.');

        confirmBtn.disabled = false;
        confirmBtn.innerHTML = 'Yes, Cancel Booking';
    }
}

// Close modal
function closeModal() {
    document.getElementById('bookingModal').classList.remove('active');
}

// Setup filter tabs
function setupFilterTabs() {
    const filterTabs = document.querySelectorAll('.filter-tab');

    filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            filterTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const status = tab.getAttribute('data-status');
            currentFilter = status;
            filterBookings(status);
        });
    });
}

// Filter bookings
function filterBookings(status) {
    let filteredBookings = allBookings;

    if (status !== 'all') {
        filteredBookings = allBookings.filter(b => b.status === status);
    }

    displayBookings(filteredBookings);
}

// Display empty state
function displayEmptyState() {
    const bookingsGrid = document.getElementById('bookingsGrid');
    bookingsGrid.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-calendar-times"></i>
            <h3>No bookings found</h3>
            <p>You haven't made any bookings yet. Browse services to get started!</p>
        </div>
    `;
}

// Display error
function displayError() {
    const bookingsGrid = document.getElementById('bookingsGrid');
    bookingsGrid.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-exclamation-circle"></i>
            <h3>Error loading bookings</h3>
            <p>Please try refreshing the page.</p>
        </div>
    `;
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
window.viewBookingDetails = viewBookingDetails;
window.openCancelModal = openCancelModal;
window.closeCancelModal = closeCancelModal;
window.confirmCancellation = confirmCancellation;
window.closeModal = closeModal;
window.handleLogout = handleLogout;

console.log('My Bookings page script loaded successfully!');