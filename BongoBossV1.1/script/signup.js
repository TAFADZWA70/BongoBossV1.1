// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    GoogleAuthProvider,
    FacebookAuthProvider,
    signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    getDatabase,
    ref,
    set
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
console.log('Initializing Firebase...');
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);
console.log('Firebase initialized successfully!');

// Providers for social login
const googleProvider = new GoogleAuthProvider();
const facebookProvider = new FacebookAuthProvider();

let accountType = 'customer';

function selectAccountType(type, element) {
    accountType = type;
    console.log('Account type selected:', type);

    // Update active state
    document.querySelectorAll('.account-type-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    element.classList.add('active');

    // Show/hide service category dropdown
    const categoryGroup = document.getElementById('categoryGroup');
    const serviceCategory = document.getElementById('serviceCategory');

    if (type === 'provider') {
        categoryGroup.style.display = 'block';
        serviceCategory.required = true;
    } else {
        categoryGroup.style.display = 'none';
        serviceCategory.required = false;
    }
}

async function handleSignup(event) {
    event.preventDefault();
    console.log('Signup form submitted');

    // Get form elements
    const form = event.target;
    const fullName = form.querySelector('input[placeholder="Enter your full name"]').value;
    const idNumber = form.querySelector('input[placeholder="Enter your Idnumber/Passporrt"]').value;
    const email = form.querySelector('input[type="email"]').value;
    const phone = form.querySelector('input[type="tel"]').value;
    const password = form.querySelector('input[type="password"]').value;
    const confirmPassword = form.querySelectorAll('input[type="password"]')[1].value;
    const serviceCategory = accountType === 'provider' ? document.getElementById('serviceCategory').value : null;

    console.log('Form data:', { fullName, idNumber, email, phone, accountType, serviceCategory });

    // Validate passwords match
    if (password !== confirmPassword) {
        alert('Passwords do not match!');
        console.error('Password mismatch');
        return;
    }

    // Validate ID number
    if (!idNumber || idNumber.trim() === '') {
        alert('Please enter your ID number or Passport');
        console.error('ID number missing');
        return;
    }

    // Validate service category for providers
    if (accountType === 'provider' && !serviceCategory) {
        alert('Please select a service category');
        console.error('Service category missing for provider');
        return;
    }

    // Disable submit button to prevent multiple submissions
    const submitBtn = form.querySelector('.signup-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating Account...';

    try {
        console.log('Creating user with email and password...');

        // Create user with email and password
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        console.log('User created successfully:', user.uid);

        // Prepare user data
        const userData = {
            uid: user.uid,
            idNumber: idNumber,
            fullName: fullName,
            email: email,
            phone: phone,
            accountType: accountType,
            createdAt: new Date().toISOString(),
            status: 'active'
        };

        // Add service category for providers
        if (accountType === 'provider' && serviceCategory) {
            userData.serviceCategory = serviceCategory;
        }

        console.log('Saving user data to database...', userData);

        // Save user data to Realtime Database using ID number as key
        await set(ref(database, `users/${idNumber}`), userData);
        console.log('User data saved to users/' + idNumber);

        // Also save a mapping from Firebase UID to ID number for easy lookup
        await set(ref(database, `userMappings/${user.uid}`), {
            idNumber: idNumber,
            email: email
        });
        console.log('User mapping saved');

        // Show success message
        alert('Account created successfully! Welcome to BongoBoss!');
        console.log('Signup complete, redirecting...');

        // Redirect based on account type
        if (accountType === 'provider') {
            window.location.href = 'provider-dashboard.html';
        } else if (accountType === 'customer') {
            window.location.href = 'Customer-dashboard.html';
        } else {
            window.location.href = 'index.html';
        }

    } catch (error) {
        console.error('Error creating account:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);

        // Handle specific error codes
        let errorMessage = 'Failed to create account. ';

        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage += 'This email is already registered.';
                break;
            case 'auth/invalid-email':
                errorMessage += 'Invalid email address.';
                break;
            case 'auth/weak-password':
                errorMessage += 'Password should be at least 6 characters.';
                break;
            case 'auth/operation-not-allowed':
                errorMessage += 'Email/password accounts are not enabled. Please contact support.';
                break;
            case 'auth/network-request-failed':
                errorMessage += 'Network error. Please check your internet connection.';
                break;
            default:
                errorMessage += error.message;
        }

        alert(errorMessage);

        // Re-enable submit button
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Account';
    }
}

async function socialSignup(platform) {
    let provider;

    switch (platform) {
        case 'google':
            provider = googleProvider;
            break;
        case 'facebook':
            provider = facebookProvider;
            break;
        case 'apple':
            alert('Apple sign-in will be implemented soon!');
            return;
        default:
            return;
    }

    console.log('Social signup initiated with:', platform);

    try {
        // Ask for ID number first for social signup
        const idNumber = prompt('Please enter your ID number or Passport:');

        if (!idNumber || idNumber.trim() === '') {
            alert('ID number is required to create an account');
            console.error('ID number not provided for social signup');
            return;
        }

        console.log('Opening social login popup...');

        // Sign in with popup
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        console.log('Social login successful:', user.uid);

        // Prepare user data
        const userData = {
            uid: user.uid,
            idNumber: idNumber,
            fullName: user.displayName || 'User',
            email: user.email,
            phone: user.phoneNumber || '',
            accountType: accountType,
            createdAt: new Date().toISOString(),
            status: 'active',
            photoURL: user.photoURL || '',
            authProvider: platform
        };

        // If provider account, ask for service category
        if (accountType === 'provider') {
            const category = prompt('Please select your service category:');
            if (category) {
                userData.serviceCategory = category;
            }
        }

        console.log('Saving social signup data...', userData);

        // Save user data to database using ID number as key
        await set(ref(database, `users/${idNumber}`), userData);
        console.log('User data saved');

        // Also save a mapping from Firebase UID to ID number
        await set(ref(database, `userMappings/${user.uid}`), {
            idNumber: idNumber,
            email: user.email
        });
        console.log('User mapping saved');

        alert('Account created successfully! Welcome to BongoBoss!');

        // Redirect based on account type
        if (accountType === 'provider') {
            window.location.href = 'provider-dashboard.html';
        } else {
            window.location.href = 'index.html';
        }

    } catch (error) {
        console.error('Social signup error:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);

        if (error.code === 'auth/popup-closed-by-user') {
            alert('Signup cancelled. Please try again.');
        } else {
            alert(`Failed to sign up with ${platform}. ${error.message}`);
        }
    }
}

// Make functions globally accessible
window.selectAccountType = selectAccountType;
window.handleSignup = handleSignup;
window.socialSignup = socialSignup;

console.log('Signup script loaded successfully!');