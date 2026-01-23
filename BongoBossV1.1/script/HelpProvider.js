// Import Firebase functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
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
console.log('Initializing Provider Help Page...');
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);
console.log('Firebase initialized successfully!');

// Web3Forms Access Key
const WEB3FORMS_ACCESS_KEY = "18e35ead-698f-4e32-bf78-6a8ea89ebfcd";

// Global user data
let currentUserData = null;
let currentIdNumber = null;

// Check authentication on load
window.addEventListener('load', async () => {
    console.log('Page loaded, checking authentication...');

    // Check if user is logged in
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log('User authenticated:', user.uid);
            try {
                await loadUserData(user.uid);
            } catch (error) {
                console.error('Error loading user data:', error);
                handleAuthError();
            }
        } else {
            console.log('No user authenticated');
            handleAuthError();
        }
    });
});

// Handle authentication errors
function handleAuthError() {
    console.error('Authentication error - redirecting to login');

    // Check session storage as fallback
    const storedUser = localStorage.getItem('bongoboss_user') || sessionStorage.getItem('bongoboss_user');

    if (!storedUser) {
        alert('Please login to access this page');
        window.location.href = '../login.html';
    } else {
        // Try to use stored data
        try {
            const userData = JSON.parse(storedUser);
            console.log('Using stored user data:', userData);

            // Verify this is a provider account
            if (userData.accountType !== 'provider') {
                alert('This page is only accessible to service providers.');
                window.location.href = '../index.html';
                return;
            }

            displayUserInfo(userData);
            populateFormFields(userData);
        } catch (error) {
            console.error('Error parsing stored data:', error);
            alert('Session expired. Please login again.');
            window.location.href = '../login.html';
        }
    }
}

// Load user data from database
async function loadUserData(uid) {
    try {
        console.log('Loading user data for UID:', uid);

        // Get ID number from userMappings
        const mappingRef = ref(database, `userMappings/${uid}`);
        const mappingSnapshot = await get(mappingRef);

        if (!mappingSnapshot.exists()) {
            console.error('User mapping not found for UID:', uid);
            throw new Error('User mapping not found. Please contact support.');
        }

        const mappingData = mappingSnapshot.val();
        currentIdNumber = mappingData.idNumber;
        console.log('Found ID number:', currentIdNumber);

        // Get full user data using ID number
        const userRef = ref(database, `users/${currentIdNumber}`);
        const userSnapshot = await get(userRef);

        if (!userSnapshot.exists()) {
            console.error('User data not found for ID:', currentIdNumber);
            throw new Error('User data not found. Please contact support.');
        }

        currentUserData = userSnapshot.val();
        console.log('User data loaded successfully:', currentUserData);

        // Verify this is a provider account
        if (currentUserData.accountType !== 'provider') {
            alert('This page is only accessible to service providers.');
            window.location.href = '../index.html';
            return;
        }

        // Display user info
        displayUserInfo(currentUserData);

        // Populate form fields
        populateFormFields(currentUserData);

        // Store in session for quick access
        sessionStorage.setItem('bongoboss_user', JSON.stringify(currentUserData));

        return currentUserData;

    } catch (error) {
        console.error('Error loading user data:', error);
        throw error;
    }
}

// Display user information in the UI
function displayUserInfo(userData) {
    console.log('Displaying user info:', userData);

    // Update user name
    const userNameElement = document.getElementById('userName');
    if (userNameElement) {
        userNameElement.textContent = userData.fullName || 'Provider';
    }

    // Update user role
    const userRoleElement = document.getElementById('userRole');
    if (userRoleElement) {
        userRoleElement.textContent = 'Service Provider';
    }

    // Update user avatar with first letter
    const userAvatarElement = document.getElementById('userAvatar');
    if (userAvatarElement && userData.fullName) {
        const firstLetter = userData.fullName.charAt(0).toUpperCase();
        userAvatarElement.textContent = firstLetter;
    }
}

// Populate contact form fields
function populateFormFields(userData) {
    console.log('Populating form fields with user data');

    const nameField = document.getElementById('contactName');
    const emailField = document.getElementById('contactEmail');

    if (nameField && userData.fullName) {
        nameField.value = userData.fullName;
    }

    if (emailField && userData.email) {
        emailField.value = userData.email;
    }
}

// Handle form submission
const contactForm = document.getElementById('contactForm');
if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('Form submission started');

        const submitBtn = document.getElementById('submitBtn');
        const originalBtnText = submitBtn.innerHTML;

        try {
            // Disable submit button
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

            // Get form values
            const name = document.getElementById('contactName').value;
            const email = document.getElementById('contactEmail').value;
            const subject = document.getElementById('contactSubject').value;
            const bookingId = document.getElementById('contactBookingId').value || 'N/A';
            const message = document.getElementById('contactMessage').value;

            // Validate form data
            if (!subject || !message) {
                throw new Error('Please fill in all required fields');
            }

            // Prepare ticket data for Firebase
            const ticketData = {
                name: name,
                email: email,
                subject: subject,
                bookingId: bookingId,
                message: message,
                userId: currentIdNumber || 'Unknown',
                userType: 'provider',
                timestamp: new Date().toISOString(),
                status: 'unread',
                createdAt: Date.now()
            };

            console.log('Ticket data:', ticketData);

            // Save to Firebase for admin records
            const ticketsRef = ref(database, 'supportTickets');
            const newTicketRef = push(ticketsRef);
            const ticketId = newTicketRef.key;

            await set(newTicketRef, ticketData);
            console.log('Support ticket saved to Firebase with ID:', ticketId);

            // Prepare email data for Web3Forms
            const formData = new FormData();
            formData.append("access_key", WEB3FORMS_ACCESS_KEY);
            formData.append("name", name);
            formData.append("email", email);
            formData.append("subject", `BongoBoss Provider Support: ${subject}`);

            // Create formatted message for email
            const emailMessage = `
Support Ticket ID: ${ticketId}

Name: ${name}
Email: ${email}
Provider ID: ${currentIdNumber || 'Unknown'}
Account Type: Service Provider
Subject Category: ${subject}
Booking ID: ${bookingId}

Message:
${message}

---
Submitted: ${new Date().toLocaleString()}
            `.trim();

            formData.append("message", emailMessage);

            // Send email via Web3Forms
            console.log('Sending email via Web3Forms...');
            const response = await fetch("https://api.web3forms.com/submit", {
                method: "POST",
                body: formData
            });

            const data = await response.json();

            if (response.ok && data.success) {
                console.log('Email sent successfully via Web3Forms');

                // Update ticket status to indicate email was sent
                await set(ref(database, `supportTickets/${ticketId}/emailSent`), true);
                await set(ref(database, `supportTickets/${ticketId}/emailSentAt`), new Date().toISOString());

                // Show success message
                showSuccessMessage();

                // Reset form after a short delay
                setTimeout(() => {
                    resetForm();
                }, 500);
            } else {
                throw new Error(data.message || 'Failed to send email');
            }

        } catch (error) {
            console.error('Error submitting form:', error);
            alert(`Failed to send message: ${error.message}. Your ticket has been saved and we will review it manually. Please contact bongoboss08@gmail.com if urgent.`);
        } finally {
            // Re-enable submit button
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    });
}

// Show success message
function showSuccessMessage() {
    const successMessage = document.getElementById('successMessage');
    if (successMessage) {
        successMessage.classList.add('active');

        // Auto-close after 5 seconds
        setTimeout(() => {
            closeSuccessMessage();
        }, 5000);
    }
}

// Close success message
function closeSuccessMessage() {
    const successMessage = document.getElementById('successMessage');
    if (successMessage) {
        successMessage.classList.remove('active');
    }
}

// Reset form
function resetForm() {
    const form = document.getElementById('contactForm');
    if (form) {
        const subject = document.getElementById('contactSubject');
        const bookingId = document.getElementById('contactBookingId');
        const message = document.getElementById('contactMessage');
        const charCount = document.getElementById('charCount');

        if (subject) subject.value = '';
        if (bookingId) bookingId.value = '';
        if (message) message.value = '';
        if (charCount) charCount.textContent = '0';
    }
}

// Toggle sidebar on mobile
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.toggle('active');
    }
}

// Handle logout
async function handleLogout() {
    console.log('Logout initiated');

    if (confirm('Are you sure you want to logout?')) {
        try {
            // Sign out from Firebase
            await signOut(auth);

            // Clear stored user data
            localStorage.removeItem('bongoboss_user');
            sessionStorage.removeItem('bongoboss_user');

            console.log('Logout successful');

            // Redirect to home page
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
window.resetForm = resetForm;
window.closeSuccessMessage = closeSuccessMessage;

console.log('Provider Help page script loaded successfully!');