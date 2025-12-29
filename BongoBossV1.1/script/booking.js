// Import Firebase functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, get, push, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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
console.log('Initializing Booking Page...');
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);
console.log('Firebase initialized successfully!');

// Global variables
let currentUser = null;
let currentIdNumber = null;
let providerId = null;
let serviceId = null;
let providerData = null;
let serviceData = null;

// Get URL parameters
function getURLParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    providerId = urlParams.get('provider');
    serviceId = urlParams.get('service');
    return { providerId, serviceId };
}

// Initialize on page load
window.addEventListener('load', async () => {
    console.log('Page loaded');

    // Get booking parameters
    const params = getURLParameters();

    if (!params.providerId || !params.serviceId) {
        alert('Invalid booking link');
        window.location.href = 'browse-services.html';
        return;
    }

    console.log('Booking for provider:', params.providerId, 'service:', params.serviceId);

    // Check authentication
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log('User authenticated:', user.uid);
            try {
                await loadUserData(user.uid);
                await loadBookingData();
            } catch (error) {
                console.error('Error loading user data:', error);
                alert('Please login to book a service');
                window.location.href = '../login.html';
            }
        } else {
            console.log('No user authenticated');
            alert('Please login to book a service');
            window.location.href = '../login.html';
        }
    });

    // Set up form listeners
    setupFormListeners();
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

        // Pre-fill contact phone if available
        if (currentUser.phone) {
            document.getElementById('contactPhone').value = currentUser.phone;
        }

    } catch (error) {
        console.error('Error loading user data:', error);
        throw error;
    }
}

// Display user info in header
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

// Load booking data
async function loadBookingData() {
    try {
        // Load provider data
        const providerRef = ref(database, `users/${providerId}`);
        const providerSnapshot = await get(providerRef);

        if (!providerSnapshot.exists()) {
            throw new Error('Provider not found');
        }

        providerData = providerSnapshot.val();

        // Load service data
        const serviceRef = ref(database, `servicePackages/${providerId}/${serviceId}`);
        const serviceSnapshot = await get(serviceRef);

        if (!serviceSnapshot.exists()) {
            throw new Error('Service not found');
        }

        serviceData = serviceSnapshot.val();

        // Display booking information
        displayBookingInfo();

        // Hide loading overlay
        document.getElementById('loadingState').style.display = 'none';

    } catch (error) {
        console.error('Error loading booking data:', error);
        alert('Error loading booking details. Please try again.');
        window.location.href = 'browse-services.html';
    }
}

// Display booking information
function displayBookingInfo() {
    const firstLetter = providerData.fullName.charAt(0).toUpperCase();

    // Service info box
    document.getElementById('providerAvatarSmall').textContent = firstLetter;
    document.getElementById('serviceName').textContent = serviceData.packageName;
    document.getElementById('providerName').textContent = providerData.fullName;
    document.getElementById('servicePrice').textContent = `R ${serviceData.price.toLocaleString()}`;

    // Summary section
    document.getElementById('summaryProvider').textContent = providerData.fullName;
    document.getElementById('summaryService').textContent = serviceData.packageName;
    document.getElementById('summaryTotal').textContent = `R ${serviceData.price.toLocaleString()}`;

    // Set minimum date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('bookingDate').min = today;
}

// Setup form listeners
function setupFormListeners() {
    const form = document.getElementById('bookingForm');
    const dateInput = document.getElementById('bookingDate');
    const timeInput = document.getElementById('bookingTime');
    const locationInput = document.getElementById('serviceLocation');

    // Update summary when inputs change
    dateInput.addEventListener('change', updateSummary);
    timeInput.addEventListener('change', updateSummary);
    locationInput.addEventListener('input', updateSummary);

    // Form submission
    form.addEventListener('submit', handleBookingSubmit);
}

// Update summary section
function updateSummary() {
    const date = document.getElementById('bookingDate').value;
    const time = document.getElementById('bookingTime').value;
    const location = document.getElementById('serviceLocation').value;

    // Format date
    if (date) {
        const dateObj = new Date(date);
        const formattedDate = dateObj.toLocaleDateString('en-ZA', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        document.getElementById('summaryDate').textContent = formattedDate;
    } else {
        document.getElementById('summaryDate').textContent = '-';
    }

    // Format time
    if (time) {
        const [hours, minutes] = time.split(':');
        const timeObj = new Date();
        timeObj.setHours(parseInt(hours), parseInt(minutes));
        const formattedTime = timeObj.toLocaleTimeString('en-ZA', {
            hour: '2-digit',
            minute: '2-digit'
        });
        document.getElementById('summaryTime').textContent = formattedTime;
    } else {
        document.getElementById('summaryTime').textContent = '-';
    }

    // Location
    if (location) {
        document.getElementById('summaryLocation').textContent = location;
    } else {
        document.getElementById('summaryLocation').textContent = '-';
    }
}

// Handle booking submission
async function handleBookingSubmit(e) {
    e.preventDefault();

    if (!currentUser || !currentIdNumber) {
        alert('Please login to continue');
        return;
    }

    // Get form data
    const formData = {
        date: document.getElementById('bookingDate').value,
        time: document.getElementById('bookingTime').value,
        location: document.getElementById('serviceLocation').value,
        notes: document.getElementById('additionalNotes').value,
        phone: document.getElementById('contactPhone').value
    };

    // Validate
    if (!formData.date || !formData.time || !formData.location || !formData.phone) {
        alert('Please fill in all required fields');
        return;
    }

    // Disable submit button
    const submitBtn = document.querySelector('.btn-submit-booking');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

    try {
        // Create booking object
        const bookingData = {
            customerId: currentIdNumber,
            customerName: currentUser.fullName,
            customerEmail: currentUser.email,
            customerPhone: formData.phone,
            providerId: providerId,
            providerName: providerData.fullName,
            providerEmail: providerData.email,
            serviceId: serviceId,
            serviceName: serviceData.packageName,
            servicePrice: serviceData.price,
            bookingDate: formData.date,
            bookingTime: formData.time,
            serviceLocation: formData.location,
            additionalNotes: formData.notes,
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Save to database
        const bookingsRef = ref(database, 'bookings');
        const newBookingRef = push(bookingsRef);
        await set(newBookingRef, bookingData);

        const bookingId = newBookingRef.key;
        console.log('Booking created:', bookingId);

        // Also save reference in customer's bookings
        const customerBookingRef = ref(database, `customerBookings/${currentIdNumber}/${bookingId}`);
        await set(customerBookingRef, {
            bookingId: bookingId,
            providerId: providerId,
            serviceId: serviceId,
            status: 'pending',
            createdAt: new Date().toISOString()
        });

        // And provider's bookings
        const providerBookingRef = ref(database, `providerBookings/${providerId}/${bookingId}`);
        await set(providerBookingRef, {
            bookingId: bookingId,
            customerId: currentIdNumber,
            serviceId: serviceId,
            status: 'pending',
            createdAt: new Date().toISOString()
        });

        // Show success modal
        showSuccessModal(bookingId);

    } catch (error) {
        console.error('Error creating booking:', error);
        alert('Error creating booking. Please try again.');

        // Re-enable submit button
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Confirm Booking';
    }
}

// Show success modal
function showSuccessModal(bookingId) {
    document.getElementById('bookingReference').textContent = bookingId;
    document.getElementById('successModal').classList.add('active');
}

// Contact provider
function contactProvider() {
    if (!providerData) return;

    const email = providerData.email;
    const phone = providerData.phone;

    let message = `Contact ${providerData.fullName}:\n\n`;
    if (email) message += `Email: ${email}\n`;
    if (phone) message += `Phone: ${phone}\n`;

    alert(message);
}

// Go to dashboard
function goToDashboard() {
    window.location.href = '../Customer-dashboard.html';
}

// View bookings
function viewBookings() {
    window.location.href = 'my-bookings.html';
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
window.contactProvider = contactProvider;
window.goToDashboard = goToDashboard;
window.viewBookings = viewBookings;
window.handleLogout = handleLogout;

console.log('Booking page script loaded successfully!');