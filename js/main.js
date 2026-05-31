document.addEventListener('DOMContentLoaded', () => {

  // ---- Mobile Menu ----
  const hamburger = document.querySelector('.hamburger');
  const navList = document.querySelector('.nav-list');

  if (hamburger) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('active');
      navList.classList.toggle('open');
    });

    // Close menu on link click
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navList.classList.remove('open');
      });
    });
  }

  // ---- Header scroll effect ----
  const header = document.querySelector('.header');
  let lastScroll = 0;

  window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;

    if (currentScroll > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }

    lastScroll = currentScroll;
  });

  // ---- Scroll-triggered fade-in ----
  const fadeElements = document.querySelectorAll('.fade-in');

  const observerOptions = {
    threshold: 0.15,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  fadeElements.forEach(el => observer.observe(el));

  // ---- Play button handler ----
  document.querySelectorAll('.btn-play').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = btn.closest('.release-card, .feature-card');
      const label = card ? card.querySelector('h4, h3')?.textContent || 'track' : 'track';
      console.log(`[Young Hadene] Play: ${label}`);
      // Placeholder — wire to your actual audio player
    });
  });

  // ---- Newsletter form ----
  const newsletterForm = document.querySelector('.newsletter-form');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = newsletterForm.querySelector('input');
      if (input.value.trim()) {
        const btn = newsletterForm.querySelector('.btn');
        const originalText = btn.textContent;
        btn.textContent = 'Joined ✓';
        btn.style.background = '#22c55e';
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.background = '';
          input.value = '';
        }, 2500);
      }
    });
  }

  // ---- Animated Counters ----
  function animateCounter(el) {
    const target = parseInt(el.getAttribute('data-target'), 10);
    if (!target) return;
    const duration = 2000;
    const startTime = performance.now();
    const startVal = 0;

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(eased * target);
      el.textContent = current;
      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        el.textContent = target;
      }
    }
    requestAnimationFrame(update);
  }

  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        counterObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('.featured-stat-number').forEach(el => {
    counterObserver.observe(el);
  });

});
