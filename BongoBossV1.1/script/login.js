// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getAuth,
    signInWithEmailAndPassword,
    GoogleAuthProvider,
    FacebookAuthProvider,
    signInWithPopup,
    sendPasswordResetEmail,
    setPersistence,
    browserSessionPersistence,
    browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    getDatabase,
    ref,
    get,
    child
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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
console.log('Initializing Firebase for login...');
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);
console.log('Firebase initialized successfully!');

// Providers for social login
const googleProvider = new GoogleAuthProvider();
const facebookProvider = new FacebookAuthProvider();

// Show error message
function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.classList.add('show');

        // Hide error after 5 seconds
        setTimeout(() => {
            errorDiv.classList.remove('show');
        }, 5000);
    } else {
        console.error('Error div not found, showing alert:', message);
        alert(message);
    }
}

// Hide error message
function hideError() {
    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv) {
        errorDiv.classList.remove('show');
    }
}

// Toggle password visibility
function togglePassword() {
    const passwordInput = document.getElementById('passwordInput');
    const toggleBtn = document.querySelector('.toggle-password');

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleBtn.textContent = '🙈';
    } else {
        passwordInput.type = 'password';
        toggleBtn.textContent = '👁️';
    }
}

// Get user data from database
async function getUserData(uid) {
    try {
        console.log('Getting user data for UID:', uid);

        // First, get the ID number from userMappings
        const mappingSnapshot = await get(child(ref(database), `userMappings/${uid}`));

        if (!mappingSnapshot.exists()) {
            console.error('User mapping not found for UID:', uid);
            throw new Error('User mapping not found');
        }

        const idNumber = mappingSnapshot.val().idNumber;
        console.log('Found ID number:', idNumber);

        // Then get the full user data using ID number
        const userSnapshot = await get(child(ref(database), `users/${idNumber}`));

        if (!userSnapshot.exists()) {
            console.error('User data not found for ID number:', idNumber);
            throw new Error('User data not found');
        }

        const userData = userSnapshot.val();
        console.log('User data retrieved successfully');
        return userData;
    } catch (error) {
        console.error('Error getting user data:', error);
        throw error;
    }
}

// Redirect user based on account type
function redirectUser(accountType) {
    console.log('Redirecting user, account type:', accountType);
    if (accountType === 'provider') {
        window.location.href = 'provider-dashboard.html';
    } else {
        window.location.href = 'index.html';
    }
}

// Handle login form submission
async function handleLogin(event) {
    event.preventDefault();
    console.log('Login form submitted');
    hideError();

    // Get form values
    const email = document.getElementById('emailInput').value;
    const password = document.getElementById('passwordInput').value;
    const rememberMe = document.getElementById('rememberMe').checked;

    console.log('Login attempt with email:', email);
    console.log('Remember me:', rememberMe);

    // Disable login button
    const loginBtn = document.getElementById('loginBtn');
    loginBtn.disabled = true;
    loginBtn.textContent = 'Logging in...';

    try {
        // Set persistence based on "Remember Me" checkbox
        console.log('Setting persistence...');
        if (rememberMe) {
            await setPersistence(auth, browserLocalPersistence);
            console.log('Using local persistence');
        } else {
            await setPersistence(auth, browserSessionPersistence);
            console.log('Using session persistence');
        }

        // Sign in with email and password
        console.log('Signing in with email and password...');
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        console.log('Sign in successful, UID:', user.uid);

        // Get user data from database
        console.log('Fetching user data from database...');
        const userData = await getUserData(user.uid);

        // Store user info in session/local storage for easy access
        const userInfo = {
            uid: user.uid,
            idNumber: userData.idNumber,
            fullName: userData.fullName,
            email: userData.email,
            accountType: userData.accountType,
            serviceCategory: userData.serviceCategory || null
        };

        console.log('Storing user info:', userInfo);

        if (rememberMe) {
            localStorage.setItem('bongoboss_user', JSON.stringify(userInfo));
        } else {
            sessionStorage.setItem('bongoboss_user', JSON.stringify(userInfo));
        }

        // Show success message
        console.log('Login successful!');
        alert('Login successful! Welcome back, ' + userData.fullName);

        // Redirect based on account type
        redirectUser(userData.accountType);

    } catch (error) {
        console.error('Login error:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);

        // Handle specific error codes
        let errorMessage = 'Login failed. ';

        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage += 'No account found with this email.';
                break;
            case 'auth/wrong-password':
                errorMessage += 'Incorrect password.';
                break;
            case 'auth/invalid-email':
                errorMessage += 'Invalid email address.';
                break;
            case 'auth/user-disabled':
                errorMessage += 'This account has been disabled.';
                break;
            case 'auth/too-many-requests':
                errorMessage += 'Too many failed attempts. Please try again later.';
                break;
            case 'auth/network-request-failed':
                errorMessage += 'Network error. Please check your connection.';
                break;
            case 'auth/invalid-credential':
                errorMessage += 'Invalid email or password.';
                break;
            default:
                if (error.message.includes('User mapping not found') || error.message.includes('User data not found')) {
                    errorMessage = 'Account data not found. Please contact support.';
                } else {
                    errorMessage += error.message;
                }
        }

        showError(errorMessage);

        // Re-enable login button
        loginBtn.disabled = false;
        loginBtn.textContent = 'Login';
    }
}

// Handle social login
async function socialLogin(platform) {
    let provider;

    switch (platform) {
        case 'google':
            provider = googleProvider;
            break;
        case 'facebook':
            provider = facebookProvider;
            break;
        case 'apple':
            showError('Apple sign-in will be implemented soon!');
            return;
        default:
            return;
    }

    console.log('Social login initiated with:', platform);
    hideError();

    try {
        console.log('Opening social login popup...');

        // Sign in with popup
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        console.log('Social login successful, UID:', user.uid);

        // Get user data from database
        console.log('Fetching user data from database...');
        const userData = await getUserData(user.uid);

        // Store user info in local storage
        const userInfo = {
            uid: user.uid,
            idNumber: userData.idNumber,
            fullName: userData.fullName,
            email: userData.email,
            accountType: userData.accountType,
            serviceCategory: userData.serviceCategory || null
        };

        console.log('Storing user info:', userInfo);
        localStorage.setItem('bongoboss_user', JSON.stringify(userInfo));

        console.log('Social login successful!');
        alert('Login successful! Welcome back, ' + userData.fullName);

        // Redirect based on account type
        redirectUser(userData.accountType);

    } catch (error) {
        console.error('Social login error:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);

        if (error.code === 'auth/popup-closed-by-user') {
            showError('Login cancelled. Please try again.');
        } else if (error.code === 'auth/popup-blocked') {
            showError('Popup was blocked. Please allow popups and try again.');
        } else if (error.message.includes('User mapping not found') || error.message.includes('User data not found')) {
            showError('Account not found. Please sign up first.');
        } else {
            showError(`Failed to login with ${platform}. ${error.message}`);
        }
    }
}

// Handle forgot password
async function handleForgotPassword(event) {
    event.preventDefault();
    console.log('Forgot password clicked');

    const email = document.getElementById('emailInput').value;

    if (!email) {
        showError('Please enter your email address first.');
        console.error('Email field is empty');
        return;
    }

    console.log('Sending password reset email to:', email);

    try {
        await sendPasswordResetEmail(auth, email);
        console.log('Password reset email sent successfully');
        alert('Password reset email sent! Please check your inbox.');
    } catch (error) {
        console.error('Password reset error:', error);
        console.error('Error code:', error.code);

        let errorMessage = 'Failed to send reset email. ';

        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage += 'No account found with this email.';
                break;
            case 'auth/invalid-email':
                errorMessage += 'Invalid email address.';
                break;
            case 'auth/too-many-requests':
                errorMessage += 'Too many requests. Please try again later.';
                break;
            default:
                errorMessage += error.message;
        }

        showError(errorMessage);
    }
}

// Check if user is already logged in
window.addEventListener('load', () => {
    console.log('Page loaded, checking for existing session...');
    const storedUser = localStorage.getItem('bongoboss_user') || sessionStorage.getItem('bongoboss_user');

    if (storedUser) {
        try {
            const userData = JSON.parse(storedUser);
            console.log('User already logged in:', userData.email);
            console.log('Account type:', userData.accountType);
            // Optionally redirect to dashboard
            // redirectUser(userData.accountType);
        } catch (error) {
            console.error('Error parsing stored user data:', error);
            // Clear corrupted data
            localStorage.removeItem('bongoboss_user');
            sessionStorage.removeItem('bongoboss_user');
        }
    } else {
        console.log('No existing session found');
    }
});

// Make functions globally accessible
window.handleLogin = handleLogin;
window.socialLogin = socialLogin;
window.togglePassword = togglePassword;
window.handleForgotPassword = handleForgotPassword;

console.log('Login script loaded successfully!');