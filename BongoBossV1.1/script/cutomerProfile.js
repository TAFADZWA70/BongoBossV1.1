// Import Firebase functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, get, set, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

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
console.log('Initializing Customer Profile...');
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);
const storage = getStorage(app);
console.log('Firebase initialized successfully!');

// Global variables
let currentUserData = null;
let currentIdNumber = null;
let originalFormData = null;

// Check authentication on load
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log('User authenticated:', user.uid);
        try {
            await loadUserData(user.uid);
            hideLoading();
        } catch (error) {
            console.error('Error loading profile:', error);
            alert('Error loading profile. Redirecting to login...');
            window.location.href = 'login.html';
        }
    } else {
        console.log('No user authenticated');
        window.location.href = '../Login.html';
    }
});

// Load user data from database
async function loadUserData(uid) {
    try {
        console.log('Loading user data for UID:', uid);

        // Get ID number from mapping
        const mappingRef = ref(database, `userMappings/${uid}`);
        const mappingSnapshot = await get(mappingRef);

        if (!mappingSnapshot.exists()) {
            throw new Error('User mapping not found');
        }

        currentIdNumber = mappingSnapshot.val().idNumber;
        console.log('Found ID number:', currentIdNumber);

        // Get user data
        const userRef = ref(database, `users/${currentIdNumber}`);
        const userSnapshot = await get(userRef);

        if (!userSnapshot.exists()) {
            throw new Error('User data not found');
        }

        currentUserData = userSnapshot.val();
        console.log('User data loaded:', currentUserData);

        // Verify customer account
        if (currentUserData.accountType !== 'customer') {
            console.error('User is not a customer');
            alert('This page is for customers only.');
            window.location.href = 'provider-dashboard.html';
            return;
        }

        // Display user data
        displayUserData();

        // Load stats
        await loadStats();

        // Load activity
        loadActivity();

    } catch (error) {
        console.error('Error loading user data:', error);
        throw error;
    }
}

// Display user data in the UI
function displayUserData() {
    console.log('Displaying user data');

    // Update all name displays
    const fullName = currentUserData.fullName || 'Customer';
    document.getElementById('profileName').textContent = fullName;
    document.getElementById('sidebarName').textContent = fullName;
    document.getElementById('profileEmail').textContent = currentUserData.email || '';

    // Update avatar with first letter
    const firstLetter = fullName.charAt(0).toUpperCase();
    document.getElementById('photoPlaceholder').textContent = firstLetter;
    document.getElementById('sidebarAvatar').textContent = firstLetter;

    // Load profile photo if exists
    if (currentUserData.photoURL) {
        const photoImg = document.getElementById('profilePhotoImg');
        photoImg.src = currentUserData.photoURL;
        photoImg.style.display = 'block';
        document.getElementById('photoPlaceholder').style.display = 'none';
    }

    // Populate form fields
    document.getElementById('fullName').value = currentUserData.fullName || '';
    document.getElementById('idNumber').value = currentIdNumber || '';
    document.getElementById('email').value = currentUserData.email || '';
    document.getElementById('phone').value = currentUserData.phone || '';
    document.getElementById('address').value = currentUserData.address || '';
    document.getElementById('city').value = currentUserData.city || '';
    document.getElementById('province').value = currentUserData.province || '';
    document.getElementById('bio').value = currentUserData.bio || '';

    // Store original form data for reset
    originalFormData = {
        fullName: currentUserData.fullName || '',
        email: currentUserData.email || '',
        phone: currentUserData.phone || '',
        address: currentUserData.address || '',
        city: currentUserData.city || '',
        province: currentUserData.province || '',
        bio: currentUserData.bio || ''
    };

    // Update rating
    const rating = currentUserData.rating || 5.0;
    document.getElementById('ratingValue').textContent = rating.toFixed(1);
    updateStarRating(rating);

    // Account status
    const accountStatus = currentUserData.status === 'active' ? 'Active' : 'Inactive';
    const statusElement = document.getElementById('accountStatus');
    statusElement.textContent = accountStatus;
    statusElement.style.color = currentUserData.status === 'active' ? '#43e97b' : '#f5576c';

    // Account created time
    if (currentUserData.createdAt) {
        const createdDate = new Date(currentUserData.createdAt);
        document.getElementById('accountCreatedTime').textContent = formatTimeAgo(createdDate);
    }
}

// Update star rating display
function updateStarRating(rating) {
    const stars = document.getElementById('ratingStars');
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    let starsHTML = '';
    for (let i = 0; i < 5; i++) {
        if (i < fullStars) {
            starsHTML += '<i class="fas fa-star"></i>';
        } else if (i === fullStars && hasHalfStar) {
            starsHTML += '<i class="fas fa-star-half-alt"></i>';
        } else {
            starsHTML += '<i class="far fa-star"></i>';
        }
    }
    stars.innerHTML = starsHTML;
}

// Load statistics
async function loadStats() {
    try {
        console.log('Loading stats for customer:', currentIdNumber);

        // Load bookings
        const bookingsRef = ref(database, 'bookings');
        const bookingsSnapshot = await get(bookingsRef);

        if (bookingsSnapshot.exists()) {
            const allBookings = bookingsSnapshot.val();

            // Filter customer's bookings
            const customerBookings = Object.values(allBookings).filter(
                booking => booking.customerId === currentIdNumber
            );

            const totalBookings = customerBookings.length;
            const completedBookings = customerBookings.filter(
                booking => booking.status === 'completed'
            ).length;

            // Update stats display
            document.getElementById('totalBookingsStat').textContent = totalBookings;
            document.getElementById('completedBookingsStat').textContent = completedBookings;

            console.log('Stats loaded:', { totalBookings, completedBookings });
        } else {
            document.getElementById('totalBookingsStat').textContent = '0';
            document.getElementById('completedBookingsStat').textContent = '0';
        }

    } catch (error) {
        console.error('Error loading stats:', error);
        document.getElementById('totalBookingsStat').textContent = '0';
        document.getElementById('completedBookingsStat').textContent = '0';
    }
}

// Load activity log
function loadActivity() {
    console.log('Loading activity log');

    const activityLog = document.getElementById('activityLog');

    // Clear existing activity
    activityLog.innerHTML = '';

    // Add account created activity
    if (currentUserData.createdAt) {
        const createdDate = new Date(currentUserData.createdAt);
        addActivityItem('Profile Created', 'Your account was successfully created', createdDate);
    }

    // Add last login activity if exists
    if (currentUserData.lastLogin) {
        const lastLoginDate = new Date(currentUserData.lastLogin);
        addActivityItem('Last Login', 'You logged into your account', lastLoginDate);
    }

    // Add profile updated activity if exists
    if (currentUserData.lastUpdated) {
        const updatedDate = new Date(currentUserData.lastUpdated);
        addActivityItem('Profile Updated', 'You updated your profile information', updatedDate);
    }
}

// Add activity item to log
function addActivityItem(title, description, date) {
    const activityLog = document.getElementById('activityLog');

    const activityItem = document.createElement('div');
    activityItem.className = 'activity-item';

    activityItem.innerHTML = `
        <div class="activity-header">
            <span class="activity-title">${title}</span>
            <span class="activity-time">${formatTimeAgo(date)}</span>
        </div>
        <p class="activity-description">${description}</p>
    `;

    activityLog.appendChild(activityItem);
}

// Format time ago
function formatTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);

    const intervals = {
        year: 31536000,
        month: 2592000,
        week: 604800,
        day: 86400,
        hour: 3600,
        minute: 60
    };

    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsInUnit);
        if (interval >= 1) {
            return interval === 1 ? `1 ${unit} ago` : `${interval} ${unit}s ago`;
        }
    }

    return 'Just now';
}

// Handle photo upload
document.getElementById('photoUpload').addEventListener('change', async (event) => {
    const file = event.target.files[0];

    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        alert('Image size must be less than 5MB');
        return;
    }

    try {
        console.log('Uploading profile photo...');

        // Show loading state
        const photoPlaceholder = document.getElementById('photoPlaceholder');
        photoPlaceholder.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        // Upload to Firebase Storage
        const photoRef = storageRef(storage, `profilePhotos/${currentIdNumber}`);
        await uploadBytes(photoRef, file);

        // Get download URL
        const photoURL = await getDownloadURL(photoRef);
        console.log('Photo uploaded successfully:', photoURL);

        // Update database
        const userRef = ref(database, `users/${currentIdNumber}`);
        await update(userRef, { photoURL: photoURL });

        // Update UI
        const photoImg = document.getElementById('profilePhotoImg');
        photoImg.src = photoURL;
        photoImg.style.display = 'block';
        photoPlaceholder.style.display = 'none';

        // Update current user data
        currentUserData.photoURL = photoURL;

        alert('Profile photo updated successfully!');

    } catch (error) {
        console.error('Error uploading photo:', error);
        alert('Error uploading photo. Please try again.');

        // Restore placeholder
        const firstLetter = currentUserData.fullName ? currentUserData.fullName.charAt(0).toUpperCase() : 'C';
        document.getElementById('photoPlaceholder').textContent = firstLetter;
    }
});

// Handle profile form submission
document.getElementById('profileForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    console.log('Profile form submitted');

    const submitBtn = event.target.querySelector('.btn-primary');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        // Get form data
        const formData = {
            fullName: document.getElementById('fullName').value.trim(),
            email: document.getElementById('email').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            address: document.getElementById('address').value.trim(),
            city: document.getElementById('city').value.trim(),
            province: document.getElementById('province').value,
            bio: document.getElementById('bio').value.trim(),
            lastUpdated: new Date().toISOString()
        };

        // Validate required fields
        if (!formData.fullName || !formData.email || !formData.phone) {
            alert('Please fill in all required fields');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
            return;
        }

        console.log('Updating user data:', formData);

        // Update database
        const userRef = ref(database, `users/${currentIdNumber}`);
        await update(userRef, formData);

        // Update current user data
        Object.assign(currentUserData, formData);

        // Update original form data
        originalFormData = { ...formData };

        // Update displays
        document.getElementById('profileName').textContent = formData.fullName;
        document.getElementById('sidebarName').textContent = formData.fullName;
        document.getElementById('profileEmail').textContent = formData.email;

        // Update avatar
        const firstLetter = formData.fullName.charAt(0).toUpperCase();
        if (!currentUserData.photoURL) {
            document.getElementById('photoPlaceholder').textContent = firstLetter;
        }
        document.getElementById('sidebarAvatar').textContent = firstLetter;

        // Add activity
        addActivityItem('Profile Updated', 'You updated your profile information', new Date());

        alert('Profile updated successfully!');

    } catch (error) {
        console.error('Error updating profile:', error);
        alert('Error updating profile. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
});

// Reset form to original data
window.resetForm = function () {
    if (!originalFormData) return;

    if (confirm('Are you sure you want to reset all changes?')) {
        document.getElementById('fullName').value = originalFormData.fullName;
        document.getElementById('email').value = originalFormData.email;
        document.getElementById('phone').value = originalFormData.phone;
        document.getElementById('address').value = originalFormData.address;
        document.getElementById('city').value = originalFormData.city;
        document.getElementById('province').value = originalFormData.province;
        document.getElementById('bio').value = originalFormData.bio;

        console.log('Form reset to original data');
    }
};

// Change password
window.changePassword = async function () {
    console.log('Change password initiated');

    const currentPassword = prompt('Enter your current password:');
    if (!currentPassword) return;

    const newPassword = prompt('Enter your new password (min 6 characters):');
    if (!newPassword || newPassword.length < 6) {
        alert('Password must be at least 6 characters');
        return;
    }

    const confirmPassword = prompt('Confirm your new password:');
    if (newPassword !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }

    try {
        const user = auth.currentUser;

        // Re-authenticate user
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);

        // Update password
        await updatePassword(user, newPassword);

        alert('Password updated successfully!');

        // Add activity
        addActivityItem('Password Changed', 'You changed your account password', new Date());

    } catch (error) {
        console.error('Error changing password:', error);

        if (error.code === 'auth/wrong-password') {
            alert('Current password is incorrect');
        } else {
            alert('Error changing password. Please try again.');
        }
    }
};

// Deactivate account
window.deactivateAccount = async function () {
    console.log('Deactivate account initiated');

    const confirmed = confirm(
        'Are you sure you want to deactivate your account?\n\n' +
        'Your account will be temporarily disabled. You can reactivate it by logging in again.'
    );

    if (!confirmed) return;

    const password = prompt('Enter your password to confirm:');
    if (!password) return;

    try {
        const user = auth.currentUser;

        // Re-authenticate user
        const credential = EmailAuthProvider.credential(user.email, password);
        await reauthenticateWithCredential(user, credential);

        // Update account status
        const userRef = ref(database, `users/${currentIdNumber}`);
        await update(userRef, {
            status: 'inactive',
            deactivatedAt: new Date().toISOString()
        });

        alert('Account deactivated successfully. You will be logged out.');

        // Sign out
        await signOut(auth);
        window.location.href = 'index.html';

    } catch (error) {
        console.error('Error deactivating account:', error);

        if (error.code === 'auth/wrong-password') {
            alert('Password is incorrect');
        } else {
            alert('Error deactivating account. Please try again.');
        }
    }
};

// Handle logout
window.handleLogout = async function () {
    console.log('Logout initiated');

    if (confirm('Are you sure you want to logout?')) {
        try {
            await signOut(auth);
            console.log('Logout successful');
            window.location.href = 'index.html';
        } catch (error) {
            console.error('Logout error:', error);
            alert('Error logging out. Please try again.');
        }
    }
};

// Toggle sidebar on mobile
window.toggleSidebar = function () {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.toggle('active');
    }
};

// Hide loading state
function hideLoading() {
    console.log('Hiding loading spinner');
    document.getElementById('loadingSpinner').classList.remove('active');
    document.getElementById('profileContent').style.display = 'block';
}

console.log('Customer profile script loaded successfully!');