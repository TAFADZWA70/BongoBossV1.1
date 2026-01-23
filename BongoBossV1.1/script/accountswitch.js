// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, get, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Your web app's Firebase configuration
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
console.log('Initializing Firebase for account switch...');
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);
console.log('Firebase initialized successfully!');

let currentUser = null;
let currentAccountType = null;

// Get current user info
function getCurrentUserInfo() {
    const storedUser = localStorage.getItem('bongoboss_user') || sessionStorage.getItem('bongoboss_user');
    if (storedUser) {
        try {
            return JSON.parse(storedUser);
        } catch (error) {
            console.error('Error parsing stored user data:', error);
            return null;
        }
    }
    return null;
}

// Update UI based on current account type
function updateUI(accountType) {
    console.log('Updating UI for account type:', accountType);

    currentAccountType = accountType;

    // Update current account display
    const currentAccountBadge = document.getElementById('currentAccountBadge');
    const currentAccountTypeEl = document.getElementById('currentAccountType');
    const currentDescriptionEl = document.getElementById('currentDescription');

    // Show/hide appropriate navigation
    const providerNav = document.getElementById('providerNav');
    const customerNav = document.getElementById('customerNav');

    if (accountType === 'provider') {
        currentAccountBadge.innerHTML = '<i class="fas fa-briefcase"></i>';
        currentAccountTypeEl.textContent = 'Service Provider';
        currentDescriptionEl.textContent = 'You are currently operating as a service provider';

        // Show provider nav, hide customer nav
        providerNav.style.display = 'block';
        customerNav.style.display = 'none';

        // Mark provider card as active
        document.getElementById('providerCard').classList.add('active');
        document.getElementById('customerCard').classList.remove('active');

        // Disable provider button, enable customer button
        document.getElementById('switchToProviderBtn').disabled = true;
        document.getElementById('switchToProviderBtn').textContent = 'Current Mode';
        document.getElementById('switchToCustomerBtn').disabled = false;
        document.getElementById('switchToCustomerBtn').innerHTML = '<i class="fas fa-exchange-alt"></i> Switch to Customer';
    } else {
        currentAccountBadge.innerHTML = '<i class="fas fa-shopping-bag"></i>';
        currentAccountTypeEl.textContent = 'Customer';
        currentDescriptionEl.textContent = 'You are currently operating as a customer';

        // Show customer nav, hide provider nav
        customerNav.style.display = 'block';
        providerNav.style.display = 'none';

        // Mark customer card as active
        document.getElementById('customerCard').classList.add('active');
        document.getElementById('providerCard').classList.remove('active');

        // Disable customer button, enable provider button
        document.getElementById('switchToCustomerBtn').disabled = true;
        document.getElementById('switchToCustomerBtn').textContent = 'Current Mode';
        document.getElementById('switchToProviderBtn').disabled = false;
        document.getElementById('switchToProviderBtn').innerHTML = '<i class="fas fa-exchange-alt"></i> Switch to Provider';
    }

    // Update user category in sidebar
    const userCategoryEl = document.getElementById('userCategory');
    if (userCategoryEl) {
        userCategoryEl.textContent = accountType === 'provider' ? 'Service Provider' : 'Customer';
    }
}

// Switch to provider mode
async function switchToProvider() {
    if (currentAccountType === 'provider') {
        console.log('Already in provider mode');
        return;
    }

    const userInfo = getCurrentUserInfo();
    if (!userInfo || !userInfo.idNumber) {
        alert('User information not found. Please login again.');
        window.location.href = '../login.html';
        return;
    }

    try {
        // Check if user has provider profile data
        const userRef = ref(database, `users/${userInfo.idNumber}`);
        const userSnapshot = await get(userRef);

        if (!userSnapshot.exists()) {
            alert('User data not found. Please login again.');
            window.location.href = '../login.html';
            return;
        }

        const userData = userSnapshot.val();

        // Check if user needs to set up provider profile
        if (!userData.serviceCategory && !userData.hasProviderProfile) {
            // Ask for service category
            const category = prompt(
                'To switch to Provider mode, please select your service category:\n\n' +
                'Enter one of:\n' +
                '- Home Services\n' +
                '- Professional Services\n' +
                '- Health & Wellness\n' +
                '- Education & Training\n' +
                '- Events & Entertainment\n' +
                '- Automotive\n' +
                '- Other'
            );

            if (!category || category.trim() === '') {
                alert('Service category is required to become a provider.');
                return;
            }

            // Confirm the switch
            if (!confirm(`Switch to Provider mode as "${category}"?`)) {
                return;
            }

            // Update button state
            const switchBtn = document.getElementById('switchToProviderBtn');
            switchBtn.disabled = true;
            switchBtn.textContent = 'Setting up...';

            // Update with service category
            await update(userRef, {
                accountType: 'provider',
                serviceCategory: category.trim(),
                hasProviderProfile: true,
                lastModified: new Date().toISOString()
            });

            // Update stored user info
            userInfo.accountType = 'provider';
            userInfo.serviceCategory = category.trim();
            userInfo.hasProviderProfile = true;
        } else {
            // User already has provider profile
            if (!confirm('Switch to Provider mode? You will be redirected to the provider dashboard.')) {
                return;
            }

            console.log('Switching to provider mode...');

            // Update button state
            const switchBtn = document.getElementById('switchToProviderBtn');
            switchBtn.disabled = true;
            switchBtn.textContent = 'Switching...';

            // Update account type in database (preserve existing provider data)
            await update(userRef, {
                accountType: 'provider',
                lastModified: new Date().toISOString()
            });

            // Update stored user info
            userInfo.accountType = 'provider';
        }

        // Update localStorage/sessionStorage
        if (localStorage.getItem('bongoboss_user')) {
            localStorage.setItem('bongoboss_user', JSON.stringify(userInfo));
        } else {
            sessionStorage.setItem('bongoboss_user', JSON.stringify(userInfo));
        }

        console.log('Successfully switched to provider mode');
        alert('Successfully switched to Provider mode!');

        // Redirect to provider dashboard
        window.location.href = 'provider-dashboard.html';

    } catch (error) {
        console.error('Error switching to provider mode:', error);
        alert('Failed to switch account mode. Please try again.');

        // Re-enable button
        const switchBtn = document.getElementById('switchToProviderBtn');
        switchBtn.disabled = false;
        switchBtn.innerHTML = '<i class="fas fa-exchange-alt"></i> Switch to Provider';
    }
}

// Switch to customer mode
async function switchToCustomer() {
    if (currentAccountType === 'customer') {
        console.log('Already in customer mode');
        return;
    }

    if (!confirm('Switch to Customer mode? Your provider profile and services will remain saved. You will be redirected to the customer dashboard.')) {
        return;
    }

    const userInfo = getCurrentUserInfo();
    if (!userInfo || !userInfo.idNumber) {
        alert('User information not found. Please login again.');
        window.location.href = '../login.html';
        return;
    }

    try {
        console.log('Switching to customer mode...');

        // Update button state
        const switchBtn = document.getElementById('switchToCustomerBtn');
        switchBtn.disabled = true;
        switchBtn.textContent = 'Switching...';

        // Update account type in database (PRESERVE provider data like serviceCategory)
        const userRef = ref(database, `users/${userInfo.idNumber}`);
        await update(userRef, {
            accountType: 'customer',
            lastModified: new Date().toISOString()
            // Note: We're NOT removing serviceCategory or hasProviderProfile
        });

        // Update stored user info
        userInfo.accountType = 'customer';
        if (localStorage.getItem('bongoboss_user')) {
            localStorage.setItem('bongoboss_user', JSON.stringify(userInfo));
        } else {
            sessionStorage.setItem('bongoboss_user', JSON.stringify(userInfo));
        }

        console.log('Successfully switched to customer mode');
        alert('Successfully switched to Customer mode!');

        // Redirect to customer dashboard
        window.location.href = 'Customer-dashboard.html';

    } catch (error) {
        console.error('Error switching to customer mode:', error);
        alert('Failed to switch account mode. Please try again.');

        // Re-enable button
        const switchBtn = document.getElementById('switchToCustomerBtn');
        switchBtn.disabled = false;
        switchBtn.innerHTML = '<i class="fas fa-exchange-alt"></i> Switch to Customer';
    }
}

// Make functions globally accessible
window.switchToProvider = switchToProvider;
window.switchToCustomer = switchToCustomer;

// Initialize page on load
window.addEventListener('load', async () => {
    console.log('Account switch page loaded');

    // Check if user is logged in
    const userInfo = getCurrentUserInfo();
    if (!userInfo) {
        console.log('No user logged in, redirecting to login');
        alert('Please login to access this page');
        window.location.href = '../login.html';
        return;
    }

    console.log('User info:', userInfo);

    // Update user name in sidebar
    const userNameEl = document.getElementById('userName');
    if (userNameEl) {
        userNameEl.textContent = userInfo.fullName || 'User';
    }

    // Update user avatar
    const userAvatarEl = document.getElementById('userAvatar');
    if (userAvatarEl && userInfo.fullName) {
        userAvatarEl.textContent = userInfo.fullName.charAt(0).toUpperCase();
    }

    // Update UI based on current account type
    updateUI(userInfo.accountType || 'customer');

    // Listen for auth state changes
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log('User authenticated:', user.uid);
            currentUser = user;

            // Fetch latest user data from database
            try {
                const mappingSnapshot = await get(ref(database, `userMappings/${user.uid}`));
                if (mappingSnapshot.exists()) {
                    const idNumber = mappingSnapshot.val().idNumber;
                    const userSnapshot = await get(ref(database, `users/${idNumber}`));

                    if (userSnapshot.exists()) {
                        const userData = userSnapshot.val();
                        console.log('Latest user data:', userData);

                        // Update UI if account type changed
                        if (userData.accountType !== currentAccountType) {
                            updateUI(userData.accountType);
                        }
                    }
                }
            } catch (error) {
                console.error('Error fetching user data:', error);
            }
        } else {
            console.log('No user authenticated');
            alert('Session expired. Please login again.');
            window.location.href = '../login.html';
        }
    });
});

console.log('Account switch script loaded successfully!');