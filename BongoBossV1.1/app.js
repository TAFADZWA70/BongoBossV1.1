// ============================================
// BONGOBOSS - INTERACTIVE JAVASCRIPT
// ============================================

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', function () {

    // ============================================
    // MOBILE MENU FUNCTIONALITY
    // ============================================
    const burger = document.getElementById('burger');
    const mobileMenu = document.getElementById('mobileMenu');
    const menuOverlay = document.getElementById('menuOverlay');
    const navbar = document.getElementById('navbar');
    const menuItems = document.querySelectorAll('.mobile-menu .menu-item');

    // Toggle mobile menu
    function toggleMenu() {
        burger.classList.toggle('active');
        mobileMenu.classList.toggle('active');
        menuOverlay.classList.toggle('active');

        // Prevent body scroll when menu is open
        if (mobileMenu.classList.contains('active')) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
    }

    // Close mobile menu
    function closeMenu() {
        burger.classList.remove('active');
        mobileMenu.classList.remove('active');
        menuOverlay.classList.remove('active');
        document.body.style.overflow = 'auto';
    }

    // Burger click event
    burger.addEventListener('click', toggleMenu);

    // Overlay click event
    menuOverlay.addEventListener('click', closeMenu);

    // Close menu when clicking menu items
    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            // If it's an anchor link, handle smooth scroll
            const href = item.getAttribute('href');
            if (href.startsWith('#')) {
                e.preventDefault();
                closeMenu();

                // Smooth scroll to section
                const targetId = href.substring(1);
                const targetSection = document.getElementById(targetId);
                if (targetSection) {
                    setTimeout(() => {
                        targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 400); // Wait for menu to close
                }
            } else {
                closeMenu();
            }
        });
    });

    // ============================================
    // NAVBAR SCROLL EFFECT
    // ============================================
    let lastScroll = 0;

    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;

        // Add scrolled class when scrolling down
        if (currentScroll > 100) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }

        lastScroll = currentScroll;
    });

    // ============================================
    // SMOOTH SCROLLING FOR ALL ANCHOR LINKS
    // ============================================
    const allLinks = document.querySelectorAll('a[href^="#"]');

    allLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');

            // Skip if it's just "#"
            if (href === '#') {
                e.preventDefault();
                return;
            }

            const targetId = href.substring(1);
            const targetSection = document.getElementById(targetId);

            if (targetSection) {
                e.preventDefault();
                targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    // ============================================
    // HERO BUTTONS SCROLL TO FEATURES
    // ============================================
    const heroButtons = document.querySelectorAll('.hero-btn');
    const featuresSection = document.getElementById('services');

    heroButtons.forEach(button => {
        button.addEventListener('click', () => {
            featuresSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    // ============================================
    // INTERSECTION OBSERVER FOR FADE-IN ANIMATIONS
    // ============================================
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    // Observe feature cards
    const featureCards = document.querySelectorAll('.feature-card');
    featureCards.forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(card);
    });

    // Observe photo service cards
    const photoCards = document.querySelectorAll('.photo-service-card');
    photoCards.forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(card);
    });

    // ============================================
    // PARALLAX EFFECT ON SCROLL
    // ============================================
    const floatingShapes = document.querySelectorAll('.floating-shape');

    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;

        floatingShapes.forEach((shape, index) => {
            const speed = 0.5 + (index * 0.2);
            const yPos = -(scrolled * speed);
            shape.style.transform = `translateY(${yPos}px)`;
        });
    });

    // ============================================
    // ADD RIPPLE EFFECT TO BUTTONS
    // ============================================
    function createRipple(event) {
        const button = event.currentTarget;
        const ripple = document.createElement('span');
        const diameter = Math.max(button.clientWidth, button.clientHeight);
        const radius = diameter / 2;

        ripple.style.width = ripple.style.height = `${diameter}px`;
        ripple.style.left = `${event.clientX - button.offsetLeft - radius}px`;
        ripple.style.top = `${event.clientY - button.offsetTop - radius}px`;
        ripple.classList.add('ripple');

        // Remove existing ripples
        const existingRipple = button.getElementsByClassName('ripple')[0];
        if (existingRipple) {
            existingRipple.remove();
        }

        button.appendChild(ripple);
    }

    // Add ripple styles dynamically
    const style = document.createElement('style');
    style.textContent = `
        .hero-btn, .cta-btn {
            position: relative;
            overflow: hidden;
        }
        .ripple {
            position: absolute;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.6);
            transform: scale(0);
            animation: ripple-animation 0.6s ease-out;
            pointer-events: none;
        }
        @keyframes ripple-animation {
            to {
                transform: scale(4);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);

    // Apply ripple to all buttons
    const allButtons = document.querySelectorAll('.hero-btn, .cta-btn, .login-btn');
    allButtons.forEach(button => {
        button.addEventListener('click', createRipple);
    });

    // ============================================
    // DYNAMIC GRADIENT ANIMATION ON MOUSE MOVE
    // ============================================
    const hero = document.querySelector('.hero');

    hero.addEventListener('mousemove', (e) => {
        const x = e.clientX / window.innerWidth;
        const y = e.clientY / window.innerHeight;

        hero.style.backgroundPosition = `${x * 100}% ${y * 100}%`;
    });

    // ============================================
    // ADD TILT EFFECT TO FEATURE CARDS
    // ============================================
    featureCards.forEach(card => {
        card.addEventListener('mousemove', handleTilt);
        card.addEventListener('mouseleave', resetTilt);
    });

    function handleTilt(e) {
        const card = e.currentTarget;
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = (y - centerY) / 10;
        const rotateY = (centerX - x) / 10;

        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-15px) scale(1.03)`;
    }

    function resetTilt(e) {
        const card = e.currentTarget;
        card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateY(0) scale(1)';
    }

    // ============================================
    // RANDOM FLOATING ANIMATION FOR SHAPES
    // ============================================
    function randomFloatAnimation() {
        floatingShapes.forEach((shape, index) => {
            const randomDelay = Math.random() * 2;
            const randomDuration = 8 + Math.random() * 4;

            shape.style.animationDelay = `${randomDelay}s`;
            shape.style.animationDuration = `${randomDuration}s`;
        });
    }

    randomFloatAnimation();

    // ============================================
    // PERFORMANCE OPTIMIZATION: THROTTLE SCROLL EVENTS
    // ============================================
    function throttle(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // ============================================
    // CONSOLE LOG WELCOME MESSAGE
    // ============================================
    console.log('%c🎨 BongoBoss - Modern Design Loaded! ', 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; font-size: 16px; padding: 10px; border-radius: 5px;');
    console.log('%cConnecting Africa, One Service at a Time', 'color: #667eea; font-size: 14px; font-weight: bold;');

    // ============================================
    // ACCESSIBILITY: KEYBOARD NAVIGATION
    // ============================================
    document.addEventListener('keydown', (e) => {
        // Close menu with ESC key
        if (e.key === 'Escape' && mobileMenu.classList.contains('active')) {
            closeMenu();
        }
    });

    // Focus trap for mobile menu
    const focusableElements = mobileMenu.querySelectorAll('a, button');
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    mobileMenu.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            if (e.shiftKey) {
                if (document.activeElement === firstFocusable) {
                    e.preventDefault();
                    lastFocusable.focus();
                }
            } else {
                if (document.activeElement === lastFocusable) {
                    e.preventDefault();
                    firstFocusable.focus();
                }
            }
        }
    });

    // ============================================
    // LOADING ANIMATION COMPLETE
    // ============================================
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.5s ease';

    setTimeout(() => {
        document.body.style.opacity = '1';
    }, 100);

    console.log('%c✅ All systems ready!', 'color: #43e97b; font-weight: bold;');
});