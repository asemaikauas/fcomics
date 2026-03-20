(() => {
  'use strict';

  // --- Footer year ---
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // --- Scroll reveal via IntersectionObserver ---
  const revealEls = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale');

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const delay = parseInt(el.dataset.delay || '0', 10);
        setTimeout(() => el.classList.add('visible'), delay);
        revealObserver.unobserve(el);
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );

  revealEls.forEach((el) => revealObserver.observe(el));

  // --- Header scroll shadow ---
  const header = document.querySelector('.site-header');
  let ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      if (header) {
        header.classList.toggle('scrolled', window.scrollY > 20);
      }
      ticking = false;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // --- Mobile menu toggle ---
  const mobileToggle = document.querySelector('.mobile-toggle');
  const siteNav = document.querySelector('.site-nav');

  if (mobileToggle && siteNav) {
    mobileToggle.addEventListener('click', () => {
      const open = siteNav.classList.toggle('open');
      mobileToggle.setAttribute('aria-expanded', String(open));
    });

    siteNav.querySelectorAll('.nav-link').forEach((link) => {
      link.addEventListener('click', () => {
        siteNav.classList.remove('open');
        mobileToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // --- Animated counters ---
  const statNumbers = document.querySelectorAll('.stat-number[data-count]');

  const counterObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = parseInt(el.dataset.count, 10);
        animateCounter(el, target);
        counterObserver.unobserve(el);
      });
    },
    { threshold: 0.5 }
  );

  statNumbers.forEach((el) => counterObserver.observe(el));

  function animateCounter(el, target) {
    const duration = 1200;
    const start = performance.now();

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target);
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  // --- Smooth parallax on hero shapes ---
  const shapes = document.querySelectorAll('.shape');

  if (shapes.length) {
    window.addEventListener('mousemove', (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      shapes.forEach((shape, i) => {
        const factor = (i + 1) * 8;
        shape.style.transform = `translate(${x * factor}px, ${y * factor}px)`;
      });
    }, { passive: true });
  }

  // --- Preview card tilt effect ---
  const previewCards = document.querySelectorAll('.preview-card');

  previewCards.forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `perspective(600px) rotateY(${x * 12}deg) rotateX(${-y * 12}deg) scale(1.04)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });

  // --- Active nav link highlight on scroll ---
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.site-nav .nav-link[href^="#"]');

  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = entry.target.id;
        navLinks.forEach((link) => {
          link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
        });
      });
    },
    { threshold: 0.3, rootMargin: '-80px 0px -40% 0px' }
  );

  sections.forEach((s) => sectionObserver.observe(s));
})();
