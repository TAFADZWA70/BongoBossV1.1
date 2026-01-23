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
console.log('Initializing Provider Profile...');
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);
const storage = getStorage(app);
console.log('Firebase initialized successfully!');

// Global variables
let currentUserData = null;
let currentIdNumber = null;
let originalFormData = null;
let userLocation = null;

// Check authentication on load
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log('User authenticated:', user.uid);
        try {
            await loadUserData(user.uid);
            await detectUserLocation(); // Detect location after loading user
            hideLoading();
        } catch (error) {
            console.error('Error loading profile:', error);
            alert('Error loading profile. Redirecting to login...');
            window.location.href = '../Login.html';
        }
    } else {
        console.log('No user authenticated');
        window.location.href = '../Login.html';
    }
});

// Detect user location using geolocation API
async function detectUserLocation() {
    console.log('Detecting user location...');

    if (!navigator.geolocation) {
        console.log('Geolocation not supported');
        return;
    }

    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            });
        });

        const { latitude, longitude } = position.coords;
        console.log('Location detected:', latitude, longitude);

        // Reverse geocode to get location details
        await reverseGeocode(latitude, longitude);

    } catch (error) {
        console.log('Geolocation error:', error.message);
        // If geolocation fails, try IP-based location
        await detectLocationByIP();
    }
}

// Reverse geocode coordinates to get address details
async function reverseGeocode(lat, lon) {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`,
            {
                headers: {
                    'User-Agent': 'BongoBoss/1.0'
                }
            }
        );

        if (!response.ok) {
            throw new Error('Geocoding failed');
        }

        const data = await response.json();
        console.log('Geocoding result:', data);

        if (data && data.address) {
            const address = data.address;

            userLocation = {
                latitude: lat,
                longitude: lon,
                city: address.city || address.town || address.village || address.suburb || '',
                province: mapToSouthAfricanProvince(address.state || address.province || ''),
                country: address.country || 'South Africa',
                fullAddress: data.display_name || ''
            };

            console.log('User location:', userLocation);

            // Update form fields if they're empty
            updateLocationFields();
        }

    } catch (error) {
        console.error('Reverse geocoding error:', error);
        // Fallback to IP-based location
        await detectLocationByIP();
    }
}

// Detect location by IP address as fallback
async function detectLocationByIP() {
    try {
        console.log('Trying IP-based location detection...');

        const response = await fetch('https://ipapi.co/json/');

        if (!response.ok) {
            throw new Error('IP location failed');
        }

        const data = await response.json();
        console.log('IP location result:', data);

        if (data) {
            userLocation = {
                latitude: data.latitude,
                longitude: data.longitude,
                city: data.city || '',
                province: mapToSouthAfricanProvince(data.region || ''),
                country: data.country_name || 'South Africa',
                fullAddress: `${data.city}, ${data.region}, ${data.country_name}`
            };

            console.log('IP-based location:', userLocation);
            updateLocationFields();
        }

    } catch (error) {
        console.error('IP location error:', error);
        console.log('Location detection failed, using default or stored values');
    }
}

// Map various province names to standard South African provinces
function mapToSouthAfricanProvince(provinceName) {
    if (!provinceName) return '';

    const provinceMap = {
        // Full names
        'gauteng': 'Gauteng',
        'western cape': 'Western Cape',
        'eastern cape': 'Eastern Cape',
        'northern cape': 'Northern Cape',
        'free state': 'Free State',
        'kwazulu-natal': 'KwaZulu-Natal',
        'kwazulu natal': 'KwaZulu-Natal',
        'limpopo': 'Limpopo',
        'mpumalanga': 'Mpumalanga',
        'north west': 'North West',
        'northwest': 'North West',

        // Alternative spellings
        'kzn': 'KwaZulu-Natal',
        'wc': 'Western Cape',
        'ec': 'Eastern Cape',
        'nc': 'Northern Cape',
        'fs': 'Free State',
        'gp': 'Gauteng',
        'lp': 'Limpopo',
        'mp': 'Mpumalanga',
        'nw': 'North West'
    };

    const normalized = provinceName.toLowerCase().trim();
    return provinceMap[normalized] || provinceName;
}

// Update location fields in the form
function updateLocationFields() {
    if (!userLocation) return;

    const cityField = document.getElementById('city');
    const provinceField = document.getElementById('province');

    // Only update if fields are empty
    if (!cityField.value && userLocation.city) {
        cityField.value = userLocation.city;
        console.log('Set city to:', userLocation.city);
    }

    if (!provinceField.value && userLocation.province) {
        provinceField.value = userLocation.province;
        console.log('Set province to:', userLocation.province);
    }

    // Store coordinates if available
    if (userLocation.latitude && userLocation.longitude && currentIdNumber) {
        // Save location to database
        const userRef = ref(database, `users/${currentIdNumber}`);
        update(userRef, {
            location: {
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
                city: userLocation.city,
                province: userLocation.province,
                updatedAt: new Date().toISOString()
            }
        }).catch(error => {
            console.error('Error saving location:', error);
        });
    }
}

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

        // Verify provider account
        if (currentUserData.accountType !== 'provider') {
            console.error('User is not a provider');
            alert('This page is for service providers only.');
            window.location.href = '../Customer-dashboard.html';
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
    const fullName = currentUserData.fullName || 'Provider';
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
    document.getElementById('businessName').value = currentUserData.businessName || '';
    document.getElementById('businessType').value = currentUserData.businessType || '';
    document.getElementById('address').value = currentUserData.address || '';
    document.getElementById('city').value = currentUserData.city || '';
    document.getElementById('province').value = currentUserData.province || '';
    document.getElementById('bio').value = currentUserData.bio || '';
    document.getElementById('yearsExperience').value = currentUserData.yearsExperience || '';
    document.getElementById('serviceRadius').value = currentUserData.serviceRadius || '';

    // Display service categories
    if (currentUserData.serviceCategories && Array.isArray(currentUserData.serviceCategories)) {
        document.getElementById('serviceCategories').value = currentUserData.serviceCategories.join(', ');
    }

    // Store original form data for reset
    originalFormData = {
        fullName: currentUserData.fullName || '',
        email: currentUserData.email || '',
        phone: currentUserData.phone || '',
        businessName: currentUserData.businessName || '',
        businessType: currentUserData.businessType || '',
        address: currentUserData.address || '',
        city: currentUserData.city || '',
        province: currentUserData.province || '',
        bio: currentUserData.bio || '',
        yearsExperience: currentUserData.yearsExperience || '',
        serviceRadius: currentUserData.serviceRadius || ''
    };

    // Update rating
    const rating = currentUserData.rating || 5.0;
    document.getElementById('ratingValue').textContent = rating.toFixed(1);
    updateStarRating(rating);

    // Bank account status
    const bankStatusElement = document.getElementById('bankStatus');
    if (currentUserData.bankDetails && currentUserData.bankDetails.accountNumber) {
        bankStatusElement.textContent = `****${currentUserData.bankDetails.accountNumber.slice(-4)}`;
        bankStatusElement.style.color = '#43e97b';
    } else {
        bankStatusElement.textContent = 'Not configured';
        bankStatusElement.style.color = '#f5576c';
    }

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
        console.log('Loading stats for provider:', currentIdNumber);

        // Load services
        const servicesRef = ref(database, 'services');
        const servicesSnapshot = await get(servicesRef);

        let activeServices = 0;
        if (servicesSnapshot.exists()) {
            const allServices = servicesSnapshot.val();
            const providerServices = Object.values(allServices).filter(
                service => service.providerId === currentIdNumber && service.status === 'active'
            );
            activeServices = providerServices.length;
        }

        // Load bookings
        const bookingsRef = ref(database, 'bookings');
        const bookingsSnapshot = await get(bookingsRef);

        let completedBookings = 0;
        if (bookingsSnapshot.exists()) {
            const allBookings = bookingsSnapshot.val();
            const providerBookings = Object.values(allBookings).filter(
                booking => booking.providerId === currentIdNumber && booking.status === 'completed'
            );
            completedBookings = providerBookings.length;
        }

        // Update stats display
        document.getElementById('totalServicesStat').textContent = activeServices;
        document.getElementById('completedBookingsStat').textContent = completedBookings;

        console.log('Stats loaded:', { activeServices, completedBookings });

    } catch (error) {
        console.error('Error loading stats:', error);
        document.getElementById('totalServicesStat').textContent = '0';
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
        addActivityItem('Profile Created', 'Your provider account was successfully created', createdDate);
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
        const firstLetter = currentUserData.fullName ? currentUserData.fullName.charAt(0).toUpperCase() : 'P';
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
            businessName: document.getElementById('businessName').value.trim(),
            businessType: document.getElementById('businessType').value,
            address: document.getElementById('address').value.trim(),
            city: document.getElementById('city').value.trim(),
            province: document.getElementById('province').value,
            bio: document.getElementById('bio').value.trim(),
            yearsExperience: parseInt(document.getElementById('yearsExperience').value) || 0,
            serviceRadius: parseInt(document.getElementById('serviceRadius').value) || 10,
            lastUpdated: new Date().toISOString()
        };

        // Validate required fields
        if (!formData.fullName || !formData.email || !formData.phone) {
            alert('Please fill in all required fields');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
            return;
        }

        console.log('Updating provider data:', formData);

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
        document.getElementById('businessName').value = originalFormData.businessName;
        document.getElementById('businessType').value = originalFormData.businessType;
        document.getElementById('address').value = originalFormData.address;
        document.getElementById('city').value = originalFormData.city;
        document.getElementById('province').value = originalFormData.province;
        document.getElementById('bio').value = originalFormData.bio;
        document.getElementById('yearsExperience').value = originalFormData.yearsExperience;
        document.getElementById('serviceRadius').value = originalFormData.serviceRadius;

        console.log('Form reset to original data');
    }
};

// Manage bank details
window.manageBankDetails = function () {
    console.log('Manage bank details initiated');

    const bankName = prompt('Enter Bank Name:', currentUserData.bankDetails?.bankName || '');
    if (!bankName) return;

    const accountNumber = prompt('Enter Account Number:', '');
    if (!accountNumber) return;

    const accountHolder = prompt('Enter Account Holder Name:', currentUserData.fullName);
    if (!accountHolder) return;

    const branchCode = prompt('Enter Branch Code:', '');
    if (!branchCode) return;

    const accountType = prompt('Enter Account Type (Cheque/Savings):', 'Cheque');
    if (!accountType) return;

    // Confirm details
    const confirmMessage = `Please confirm your bank details:\n\n` +
        `Bank: ${bankName}\n` +
        `Account Number: ${accountNumber}\n` +
        `Account Holder: ${accountHolder}\n` +
        `Branch Code: ${branchCode}\n` +
        `Account Type: ${accountType}\n\n` +
        `Are these details correct?`;

    if (!confirm(confirmMessage)) {
        return;
    }

    try {
        const bankDetails = {
            bankName,
            accountNumber,
            accountHolder,
            branchCode,
            accountType,
            updatedAt: new Date().toISOString()
        };

        // Update database
        const userRef = ref(database, `users/${currentIdNumber}`);
        update(userRef, { bankDetails });

        // Update current user data
        currentUserData.bankDetails = bankDetails;

        // Update display
        const bankStatusElement = document.getElementById('bankStatus');
        bankStatusElement.textContent = `****${accountNumber.slice(-4)}`;
        bankStatusElement.style.color = '#43e97b';

        // Add activity
        addActivityItem('Bank Details Updated', 'You updated your payment information', new Date());

        alert('Bank details saved successfully!');

    } catch (error) {
        console.error('Error saving bank details:', error);
        alert('Error saving bank details. Please try again.');
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
        'Are you sure you want to deactivate your provider account?\n\n' +
        'Your services will be hidden and you won\'t receive new bookings.\n' +
        'You can reactivate it by logging in again.'
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
        window.location.href = '../index.html';

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
            window.location.href = '../index.html';
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

console.log('Provider profile script loaded successfully!');