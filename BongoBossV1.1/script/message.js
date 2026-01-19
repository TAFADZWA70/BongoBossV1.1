// Import Firebase functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, get, push, set, onValue, query, orderByChild, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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
let userType = null; // 'customer' or 'provider'
let conversations = [];
let activeConversation = null;
let messages = [];
let messageListeners = {};

// Initialize on page load
window.addEventListener('load', async () => {
    console.log('Messages page loaded');

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log('User authenticated:', user.uid);
            try {
                await loadUserData(user.uid);
                setupNavigation();
                await loadConversations();
                setupEventListeners();
            } catch (error) {
                console.error('Error loading data:', error);
                alert('Please login to access messages');
                window.location.href = '../login.html';
            }
        } else {
            console.log('No user authenticated');
            alert('Please login to access messages');
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
        userType = currentUser.accountType;

        displayUserInfo(currentUser);

    } catch (error) {
        console.error('Error loading user data:', error);
        throw error;
    }
}

// Display user info
function displayUserInfo(userData) {
    const userNameElement = document.getElementById('userName');
    const userRoleElement = document.getElementById('userRole');
    const userAvatarElement = document.getElementById('userAvatar');

    if (userNameElement) {
        userNameElement.textContent = userData.fullName || 'User';
    }

    if (userRoleElement) {
        userRoleElement.textContent = userType === 'provider' ? 'Service Provider' : 'Customer';
    }

    if (userAvatarElement && userData.fullName) {
        const firstLetter = userData.fullName.charAt(0).toUpperCase();
        userAvatarElement.textContent = firstLetter;
    }
}

// Setup navigation based on user type
function setupNavigation() {
    const sidebarNav = document.getElementById('sidebarNav');

    if (userType === 'provider') {
        sidebarNav.innerHTML = `
            <a href="provider-dashboard.html" class="nav-item">
                <span class="icon"><i class="fas fa-chart-line"></i></span>
                <span class="label">Dashboard</span>
            </a>
            <a href="provider pages/Portfolio&Services-Management.html" class="nav-item">
                <span class="icon"><i class="fas fa-briefcase"></i></span>
                <span class="label">Portfolio & Services</span>
            </a>
            <a href="provider pages/mybookings.html" class="nav-item">
                <span class="icon"><i class="fas fa-calendar-alt"></i></span>
                <span class="label">Bookings</span>
            </a>
            <a href="messages.html" class="nav-item active">
                <span class="icon"><i class="fas fa-comments"></i></span>
                <span class="label">Messages</span>
            </a>
            <a href="profile.html" class="nav-item">
                <span class="icon"><i class="fas fa-user"></i></span>
                <span class="label">Profile</span>
            </a>
        `;
    } else {
        sidebarNav.innerHTML = `
            <a href="Customer-dashboard.html" class="nav-item">
                <span class="icon"><i class="fas fa-home"></i></span>
                <span class="label">Dashboard</span>
            </a>
            <a href="customer pages/browse-services.html" class="nav-item">
                <span class="icon"><i class="fas fa-search"></i></span>
                <span class="label">Browse Services</span>
            </a>
            <a href="customer pages/mybookingscustomer.html" class="nav-item">
                <span class="icon"><i class="fas fa-calendar-check"></i></span>
                <span class="label">My Bookings</span>
            </a>
            <a href="messages.html" class="nav-item active">
                <span class="icon"><i class="fas fa-comments"></i></span>
                <span class="label">Messages</span>
            </a>
            <a href="customer pages/CustomerProfile.html" class="nav-item">
                <span class="icon"><i class="fas fa-user"></i></span>
                <span class="label">Profile</span>
            </a>
        `;
    }
}

// Load conversations from bookings
async function loadConversations() {
    try {
        const bookingsRef = ref(database, 'bookings');
        const bookingsSnapshot = await get(bookingsRef);

        if (!bookingsSnapshot.exists()) {
            displayEmptyConversations();
            return;
        }

        const allBookings = bookingsSnapshot.val();
        const conversationsMap = new Map();

        // Filter bookings where user is involved and status is confirmed or completed
        for (const [bookingId, booking] of Object.entries(allBookings)) {
            const isUserInvolved = userType === 'provider'
                ? booking.providerId === currentIdNumber
                : booking.customerId === currentIdNumber;

            if (isUserInvolved && (booking.status === 'confirmed' || booking.status === 'completed')) {
                const otherUserId = userType === 'provider' ? booking.customerId : booking.providerId;

                // Create unique conversation ID
                const conversationId = createConversationId(booking.customerId, booking.providerId);

                if (!conversationsMap.has(conversationId)) {
                    conversationsMap.set(conversationId, {
                        id: conversationId,
                        bookingId: bookingId,
                        otherUserId: otherUserId,
                        otherUserName: userType === 'provider' ? booking.customerName : booking.providerName,
                        serviceName: booking.serviceName,
                        lastMessage: '',
                        lastMessageTime: booking.createdAt,
                        unreadCount: 0
                    });
                }
            }
        }

        conversations = Array.from(conversationsMap.values());

        // Load last messages for each conversation
        await Promise.all(conversations.map(async (conv) => {
            const lastMessage = await getLastMessage(conv.id);
            if (lastMessage) {
                conv.lastMessage = lastMessage.text;
                conv.lastMessageTime = lastMessage.timestamp;
                conv.unreadCount = await getUnreadCount(conv.id);
            }
        }));

        // Sort by last message time
        conversations.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));

        displayConversations(conversations);

    } catch (error) {
        console.error('Error loading conversations:', error);
        displayEmptyConversations();
    }
}

// Create conversation ID (consistent order)
function createConversationId(customerId, providerId) {
    return `${customerId}_${providerId}`;
}

// Get last message from conversation
async function getLastMessage(conversationId) {
    try {
        const messagesRef = ref(database, `messages/${conversationId}`);
        const messagesSnapshot = await get(messagesRef);

        if (!messagesSnapshot.exists()) {
            return null;
        }

        const messagesData = messagesSnapshot.val();
        const messagesArray = Object.values(messagesData);

        if (messagesArray.length === 0) return null;

        // Sort by timestamp and get last message
        messagesArray.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        return messagesArray[0];

    } catch (error) {
        console.error('Error getting last message:', error);
        return null;
    }
}

// Get unread count
async function getUnreadCount(conversationId) {
    try {
        const messagesRef = ref(database, `messages/${conversationId}`);
        const messagesSnapshot = await get(messagesRef);

        if (!messagesSnapshot.exists()) {
            return 0;
        }

        const messagesData = messagesSnapshot.val();
        let count = 0;

        for (const message of Object.values(messagesData)) {
            if (message.senderId !== currentIdNumber && !message.read) {
                count++;
            }
        }

        return count;

    } catch (error) {
        console.error('Error getting unread count:', error);
        return 0;
    }
}

// Display conversations
function displayConversations(conversations) {
    const conversationsList = document.getElementById('conversationsList');

    if (conversations.length === 0) {
        displayEmptyConversations();
        return;
    }

    conversationsList.innerHTML = '';

    conversations.forEach(conv => {
        const conversationItem = createConversationItem(conv);
        conversationsList.appendChild(conversationItem);
    });
}

// Create conversation item
function createConversationItem(conv) {
    const item = document.createElement('div');
    item.className = 'conversation-item';
    item.onclick = () => openConversation(conv);

    const firstLetter = conv.otherUserName.charAt(0).toUpperCase();
    const timeAgo = getTimeAgo(conv.lastMessageTime);

    item.innerHTML = `
        <div class="conversation-avatar">${firstLetter}</div>
        <div class="conversation-info">
            <div class="conversation-header">
                <span class="conversation-name">${conv.otherUserName}</span>
                <span class="conversation-time">${timeAgo}</span>
            </div>
            <p class="conversation-preview">${conv.lastMessage || conv.serviceName}</p>
        </div>
        ${conv.unreadCount > 0 ? `<div class="unread-badge">${conv.unreadCount}</div>` : ''}
    `;

    return item;
}

// Open conversation
async function openConversation(conv) {
    activeConversation = conv;

    // Update UI
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.remove('active');
    });
    event.currentTarget?.classList.add('active');

    // Show chat panel
    document.querySelector('.chat-empty-state').style.display = 'none';
    document.getElementById('activeChat').style.display = 'flex';

    // Update chat header
    const firstLetter = conv.otherUserName.charAt(0).toUpperCase();
    document.getElementById('chatAvatar').textContent = firstLetter;
    document.getElementById('chatUserName').textContent = conv.otherUserName;
    document.getElementById('chatUserStatus').textContent = conv.serviceName;

    // Mobile: show chat panel, hide conversations
    if (window.innerWidth <= 768) {
        document.getElementById('conversationsPanel').classList.remove('active');
        document.getElementById('chatPanel').classList.add('active');
    }

    // Load messages
    await loadMessages(conv.id);

    // Mark messages as read
    await markMessagesAsRead(conv.id);
}

// Load messages
async function loadMessages(conversationId) {
    try {
        // Remove previous listener if exists
        if (messageListeners[conversationId]) {
            messageListeners[conversationId]();
        }

        const messagesRef = ref(database, `messages/${conversationId}`);

        // Set up real-time listener
        const unsubscribe = onValue(messagesRef, (snapshot) => {
            const messagesArea = document.getElementById('messagesArea');
            messagesArea.innerHTML = '';

            if (!snapshot.exists()) {
                messagesArea.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-comment-dots"></i>
                        <h3>No messages yet</h3>
                        <p>Start the conversation by sending a message</p>
                    </div>
                `;
                return;
            }

            const messagesData = snapshot.val();
            messages = Object.entries(messagesData).map(([id, msg]) => ({
                id,
                ...msg
            }));

            // Sort by timestamp
            messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

            // Group messages by date
            const groupedMessages = groupMessagesByDate(messages);

            // Display messages
            for (const [date, msgs] of Object.entries(groupedMessages)) {
                // Add date divider
                const dateDivider = document.createElement('div');
                dateDivider.className = 'date-divider';
                dateDivider.innerHTML = `<span>${date}</span>`;
                messagesArea.appendChild(dateDivider);

                // Add messages
                msgs.forEach(msg => {
                    const messageElement = createMessageElement(msg);
                    messagesArea.appendChild(messageElement);
                });
            }

            // Scroll to bottom
            messagesArea.scrollTop = messagesArea.scrollHeight;
        });

        messageListeners[conversationId] = unsubscribe;

    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

// Group messages by date
function groupMessagesByDate(messages) {
    const grouped = {};

    messages.forEach(msg => {
        const date = formatDate(msg.timestamp);
        if (!grouped[date]) {
            grouped[date] = [];
        }
        grouped[date].push(msg);
    });

    return grouped;
}

// Create message element
function createMessageElement(msg) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${msg.senderId === currentIdNumber ? 'sent' : 'received'}`;

    const firstLetter = msg.senderName?.charAt(0).toUpperCase() || 'U';
    const time = new Date(msg.timestamp).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
    });

    messageDiv.innerHTML = `
        <div class="message-avatar">${firstLetter}</div>
        <div class="message-content">
            <div class="message-bubble">${escapeHtml(msg.text)}</div>
            <div class="message-time">${time}</div>
        </div>
    `;

    return messageDiv;
}

// Send message
async function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const text = messageInput.value.trim();

    if (!text || !activeConversation) return;

    const sendBtn = document.getElementById('sendBtn');
    sendBtn.disabled = true;

    try {
        const messagesRef = ref(database, `messages/${activeConversation.id}`);
        const newMessageRef = push(messagesRef);

        const messageData = {
            text: text,
            senderId: currentIdNumber,
            senderName: currentUser.fullName,
            timestamp: new Date().toISOString(),
            read: false
        };

        await set(newMessageRef, messageData);

        // Clear input
        messageInput.value = '';
        messageInput.focus();

    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message. Please try again.');
    } finally {
        sendBtn.disabled = false;
    }
}

// Mark messages as read
async function markMessagesAsRead(conversationId) {
    try {
        const messagesRef = ref(database, `messages/${conversationId}`);
        const messagesSnapshot = await get(messagesRef);

        if (!messagesSnapshot.exists()) return;

        const messagesData = messagesSnapshot.val();
        const updates = {};

        for (const [msgId, msg] of Object.entries(messagesData)) {
            if (msg.senderId !== currentIdNumber && !msg.read) {
                updates[`messages/${conversationId}/${msgId}/read`] = true;
            }
        }

        if (Object.keys(updates).length > 0) {
            await update(ref(database), updates);

            // Update conversation unread count
            const conversation = conversations.find(c => c.id === conversationId);
            if (conversation) {
                conversation.unreadCount = 0;
            }
        }

    } catch (error) {
        console.error('Error marking messages as read:', error);
    }
}

// View booking details
async function viewBookingDetails() {
    if (!activeConversation) return;

    try {
        const bookingRef = ref(database, `bookings/${activeConversation.bookingId}`);
        const bookingSnapshot = await get(bookingRef);

        if (!bookingSnapshot.exists()) {
            alert('Booking not found');
            return;
        }

        const booking = bookingSnapshot.val();
        const modal = document.getElementById('bookingModal');
        const modalBody = document.getElementById('bookingModalBody');

        const date = booking.bookingDate ? new Date(booking.bookingDate).toLocaleDateString('en-ZA', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }) : 'Date TBD';

        modalBody.innerHTML = `
            <div style="padding: 1rem;">
                <h3 style="margin-bottom: 1rem; color: var(--text-dark);">${booking.serviceName}</h3>
                <div style="display: grid; gap: 1rem;">
                    <div>
                        <strong>Status:</strong>
                        <span class="booking-status ${booking.status}" style="margin-left: 0.5rem; padding: 0.3rem 0.8rem; border-radius: 15px; font-size: 0.85rem;">${booking.status}</span>
                    </div>
                    <div><strong>Provider:</strong> ${booking.providerName}</div>
                    <div><strong>Customer:</strong> ${booking.customerName}</div>
                    <div><strong>Date:</strong> ${date}</div>
                    <div><strong>Time:</strong> ${booking.bookingTime || 'TBD'}</div>
                    <div><strong>Location:</strong> ${booking.serviceLocation || 'N/A'}</div>
                    <div><strong>Price:</strong> R ${booking.servicePrice?.toLocaleString() || 0}</div>
                    ${booking.additionalNotes ? `<div><strong>Notes:</strong> ${booking.additionalNotes}</div>` : ''}
                </div>
            </div>
        `;

        modal.classList.add('active');

    } catch (error) {
        console.error('Error loading booking details:', error);
        alert('Failed to load booking details');
    }
}

// Setup event listeners
function setupEventListeners() {
    // Send message on button click
    document.getElementById('sendBtn').addEventListener('click', sendMessage);

    // Send message on Enter key
    document.getElementById('messageInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // View booking button
    document.getElementById('viewBookingBtn').addEventListener('click', viewBookingDetails);

    // Search conversations
    document.getElementById('searchConversations').addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredConversations = conversations.filter(conv =>
            conv.otherUserName.toLowerCase().includes(searchTerm) ||
            conv.serviceName.toLowerCase().includes(searchTerm)
        );
        displayConversations(filteredConversations);
    });
}

// Display empty conversations
function displayEmptyConversations() {
    const conversationsList = document.getElementById('conversationsList');
    conversationsList.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-comments"></i>
            <h3>No conversations yet</h3>
            <p>Start chatting with your confirmed bookings</p>
        </div>
    `;
}

// Close chat (mobile)
function closeChat() {
    if (window.innerWidth <= 768) {
        document.getElementById('chatPanel').classList.remove('active');
        document.getElementById('conversationsPanel').classList.add('active');
    }
}

// Close booking modal
function closeBookingModal() {
    document.getElementById('bookingModal').classList.remove('active');
}

// Toggle sidebar
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
}

// Handle logout
async function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        try {
            // Clean up listeners
            Object.values(messageListeners).forEach(unsubscribe => unsubscribe());

            await signOut(auth);
            localStorage.removeItem('bongoboss_user');
            sessionStorage.removeItem('bongoboss_user');
            window.location.href = userType === 'provider' ? '../index.html' : 'index.html';
        } catch (error) {
            console.error('Logout error:', error);
            alert('Error logging out. Please try again.');
        }
    }
}

// Utility functions
function getTimeAgo(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diff = Math.floor((now - time) / 1000);

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;

    return time.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDate(timestamp) {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
        return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    } else {
        return date.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
        });
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make functions globally accessible
window.toggleSidebar = toggleSidebar;
window.closeChat = closeChat;
window.closeBookingModal = closeBookingModal;
window.handleLogout = handleLogout;

console.log('Messages page script loaded successfully!');