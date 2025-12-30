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
let currentAction = null;

// Initialize on page load
window.addEventListener('load', async () => {
    console.log('Provider Bookings page loaded');

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
    const userCategoryElement = document.getElementById('userCategory');
    const userAvatarElement = document.getElementById('userAvatar');

    if (userNameElement) {
        userNameElement.textContent = userData.fullName || 'Provider';
    }

    if (userCategoryElement && userData.serviceCategory) {
        userCategoryElement.textContent = getCategoryDisplayName(userData.serviceCategory);
    }

    if (userAvatarElement && userData.fullName) {
        const firstLetter = userData.fullName.charAt(0).toUpperCase();
        userAvatarElement.textContent = firstLetter;
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

// Load bookings
async function loadBookings() {
    try {
        console.log('Loading bookings for provider:', currentIdNumber);

        const bookingsRef = ref(database, 'bookings');
        const bookingsSnapshot = await get(bookingsRef);

        if (!bookingsSnapshot.exists()) {
            displayEmptyState();
            updateStats({ pending: 0, confirmed: 0, completed: 0, total: 0 });
            return;
        }

        const allBookingsData = bookingsSnapshot.val();

        // Filter bookings for current provider
        allBookings = Object.keys(allBookingsData)
            .map(key => ({
                id: key,
                ...allBookingsData[key]
            }))
            .filter(booking => booking.providerId === currentIdNumber)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        console.log('Loaded bookings:', allBookings.length);

        // Update stats
        const stats = {
            pending: allBookings.filter(b => b.status === 'pending').length,
            confirmed: allBookings.filter(b => b.status === 'confirmed').length,
            completed: allBookings.filter(b => b.status === 'completed').length,
            total: allBookings.length
        };
        updateStats(stats);

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

// Update stats
function updateStats(stats) {
    document.getElementById('pendingCount').textContent = stats.pending;
    document.getElementById('confirmedCount').textContent = stats.confirmed;
    document.getElementById('completedCount').textContent = stats.completed;
    document.getElementById('totalCount').textContent = stats.total;
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
    const customerName = booking.customerName || 'Customer';
    const price = booking.servicePrice || 0;
    const date = booking.bookingDate ? new Date(booking.bookingDate).toLocaleDateString() : 'Date TBD';
    const time = booking.bookingTime || 'TBD';

    let actions = '';
    if (statusClass === 'pending') {
        actions = `
            <button class="btn-action btn-accept" onclick="openActionModal('${booking.id}', 'accept')">
                <i class="fas fa-check"></i> Accept
            </button>
            <button class="btn-action btn-reject" onclick="openActionModal('${booking.id}', 'reject')">
                <i class="fas fa-times"></i> Reject
            </button>
        `;
    } else if (statusClass === 'confirmed') {
        actions = `
            <button class="btn-action btn-view" onclick="viewBookingDetails('${booking.id}')">
                <i class="fas fa-eye"></i> View
            </button>
            <button class="btn-action btn-complete" onclick="openActionModal('${booking.id}', 'complete')">
                <i class="fas fa-check-circle"></i> Complete
            </button>
        `;
    } else {
        actions = `
            <button class="btn-action btn-view" onclick="viewBookingDetails('${booking.id}')">
                <i class="fas fa-eye"></i> View Details
            </button>
        `;
    }

    card.innerHTML = `
        <div class="booking-header">
            <h3 class="booking-title">${serviceName}</h3>
            <span class="booking-status ${statusClass}">${statusClass}</span>
        </div>
        <div class="booking-info">
            <div class="info-row">
                <i class="fas fa-user"></i>
                <span><strong>Customer:</strong> ${customerName}</span>
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
            ${actions}
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
    const customerName = booking.customerName || 'Customer';
    const price = booking.servicePrice || 0;
    const date = booking.bookingDate ? new Date(booking.bookingDate).toLocaleDateString('en-ZA', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }) : 'Date TBD';
    const time = booking.bookingTime || 'TBD';

    let modalActions = '';
    if (statusClass === 'pending') {
        modalActions = `
            <button class="btn-success" onclick="openActionModal('${booking.id}', 'accept')">
                <i class="fas fa-check"></i> Accept Booking
            </button>
            <button class="btn-danger" onclick="openActionModal('${booking.id}', 'reject')">
                <i class="fas fa-times"></i> Reject Booking
            </button>
        `;
    } else if (statusClass === 'confirmed') {
        modalActions = `
            <button class="btn-secondary" onclick="closeModal()">
                <i class="fas fa-times"></i> Close
            </button>
            <button class="btn-success" onclick="openActionModal('${booking.id}', 'complete')">
                <i class="fas fa-check-circle"></i> Mark as Complete
            </button>
        `;
    } else {
        modalActions = `
            <button class="btn-primary" onclick="closeModal()">
                <i class="fas fa-times"></i> Close
            </button>
        `;
    }

    modalBody.innerHTML = `
        <div class="modal-header">
            <span class="modal-status-badge booking-status ${statusClass}">${statusClass}</span>
            <h2>${serviceName}</h2>
            <p>Booking Reference: <strong>${booking.id}</strong></p>
        </div>

        <div class="modal-section">
            <h3><i class="fas fa-user"></i> Customer Information</h3>
            <div class="detail-grid">
                <div class="detail-item">
                    <span class="detail-label">Customer Name</span>
                    <span class="detail-value">${customerName}</span>
                </div>
                ${booking.customerEmail ? `
                    <div class="detail-item">
                        <span class="detail-label">Email</span>
                        <span class="detail-value">${booking.customerEmail}</span>
                    </div>
                ` : ''}
                ${booking.customerPhone ? `
                    <div class="detail-item">
                        <span class="detail-label">Phone</span>
                        <span class="detail-value">${booking.customerPhone}</span>
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
                <div class="detail-item">
                    <span class="detail-label">Booked On</span>
                    <span class="detail-value">${new Date(booking.createdAt).toLocaleDateString()}</span>
                </div>
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
                <span class="detail-label">Service Amount</span>
                <span class="detail-value">R ${price.toLocaleString()}</span>
            </div>
        </div>

        <div class="modal-actions">
            ${modalActions}
        </div>
    `;

    modal.classList.add('active');
}

// Open action modal
function openActionModal(bookingId, action) {
    selectedBookingId = bookingId;
    currentAction = action;

    const modal = document.getElementById('actionModal');
    const actionIcon = document.getElementById('actionIcon');
    const actionTitle = document.getElementById('actionTitle');
    const actionMessage = document.getElementById('actionMessage');
    const actionNotes = document.getElementById('actionNotes');
    const confirmBtn = document.getElementById('confirmActionBtn');

    closeModal(); // Close details modal if open

    if (action === 'accept') {
        actionIcon.innerHTML = '<i class="fas fa-check-circle"></i>';
        actionIcon.style.background = 'rgba(16, 185, 129, 0.1)';
        actionIcon.style.color = 'var(--success-green)';
        actionTitle.textContent = 'Accept Booking?';
        actionMessage.textContent = 'Confirm that you want to accept this booking request.';
        actionNotes.style.display = 'none';
        confirmBtn.className = 'btn-primary btn-success';
        confirmBtn.innerHTML = '<i class="fas fa-check"></i> Accept Booking';
    } else if (action === 'reject') {
        actionIcon.innerHTML = '<i class="fas fa-times-circle"></i>';
        actionIcon.style.background = 'rgba(239, 68, 68, 0.1)';
        actionIcon.style.color = 'var(--danger-red)';
        actionTitle.textContent = 'Reject Booking?';
        actionMessage.textContent = 'Are you sure you want to reject this booking request?';
        actionNotes.style.display = 'block';
        confirmBtn.className = 'btn-primary btn-danger';
        confirmBtn.innerHTML = '<i class="fas fa-times"></i> Reject Booking';
    } else if (action === 'complete') {
        actionIcon.innerHTML = '<i class="fas fa-star"></i>';
        actionIcon.style.background = 'rgba(102, 126, 234, 0.1)';
        actionIcon.style.color = 'var(--primary-purple)';
        actionTitle.textContent = 'Mark as Complete?';
        actionMessage.textContent = 'Confirm that this service has been completed successfully.';
        actionNotes.style.display = 'none';
        confirmBtn.className = 'btn-primary btn-success';
        confirmBtn.innerHTML = '<i class="fas fa-check-circle"></i> Mark Complete';
    }

    modal.classList.add('active');
}

// Close action modal
function closeActionModal() {
    selectedBookingId = null;
    currentAction = null;
    document.getElementById('actionReason').value = '';
    document.getElementById('actionModal').classList.remove('active');
}

// Confirm action
async function confirmAction() {
    if (!selectedBookingId || !currentAction) return;

    const reason = document.getElementById('actionReason').value;
    const confirmBtn = document.getElementById('confirmActionBtn');

    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

    try {
        const bookingRef = ref(database, `bookings/${selectedBookingId}`);
        let updateData = {
            updatedAt: new Date().toISOString()
        };

        if (currentAction === 'accept') {
            updateData.status = 'confirmed';
            updateData.confirmedAt = new Date().toISOString();
        } else if (currentAction === 'reject') {
            updateData.status = 'cancelled';
            updateData.rejectionReason = reason || 'No reason provided';
            updateData.cancelledBy = 'provider';
            updateData.cancelledAt = new Date().toISOString();
        } else if (currentAction === 'complete') {
            updateData.status = 'completed';
            updateData.completedAt = new Date().toISOString();
        }

        await update(bookingRef, updateData);

        // Update local data
        const bookingIndex = allBookings.findIndex(b => b.id === selectedBookingId);
        if (bookingIndex !== -1) {
            allBookings[bookingIndex].status = updateData.status;
        }

        closeActionModal();
        await loadBookings();
        filterBookings(currentFilter);

        const actionText = currentAction === 'accept' ? 'accepted' :
            currentAction === 'reject' ? 'rejected' : 'completed';
        alert(`Booking ${actionText} successfully`);

    } catch (error) {
        console.error('Error updating booking:', error);
        alert('Error updating booking. Please try again.');

        confirmBtn.disabled = false;
        confirmBtn.innerHTML = currentAction === 'accept' ? 'Accept Booking' :
            currentAction === 'reject' ? 'Reject Booking' : 'Mark Complete';
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
            <p>Your booking requests will appear here once customers start booking your services.</p>
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

// Toggle sidebar
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('active');
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
window.viewBookingDetails = viewBookingDetails;
window.openActionModal = openActionModal;
window.closeActionModal = closeActionModal;
window.confirmAction = confirmAction;
window.closeModal = closeModal;
window.toggleSidebar = toggleSidebar;
window.handleLogout = handleLogout;

console.log('Provider Bookings page script loaded successfully!');