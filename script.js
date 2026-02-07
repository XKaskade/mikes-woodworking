/* ==========================================================================
   MIKE'S WOODWORKING — Carousel Gallery & Interactions
   ========================================================================== */

(function () {
  'use strict';

  // -----------------------------------------------------------------------
  // DOM Helpers
  // -----------------------------------------------------------------------
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => [...(ctx || document).querySelectorAll(sel)];

  // -----------------------------------------------------------------------
  // DOM References
  // -----------------------------------------------------------------------
  const dom = {
    nav: $('#nav'),
    navToggle: $('#navToggle'),
    mobileMenu: $('#mobileMenu'),
    lightbox: $('#lightbox'),
    lightboxImage: $('#lightboxImage'),
    lightboxTitle: $('#lightboxTitle'),
    lightboxCaption: $('#lightboxCaption'),
    lightboxClose: $('#lightboxClose'),
    lightboxPrev: $('#lightboxPrev'),
    lightboxNext: $('#lightboxNext'),
    contactForm: $('#contactForm'),
    footerYear: $('#footerYear'),
  };

  // -----------------------------------------------------------------------
  // Carousel Engine
  // -----------------------------------------------------------------------
  const carousels = [];

  function initCarousels() {
    $$('.carousel').forEach((el) => {
      const track = $('.carousel-track', el);
      const slides = $$('.carousel-slide', el);
      const prevBtn = $('.carousel-prev', el);
      const nextBtn = $('.carousel-next', el);
      const counter = $('.carousel-counter', el);
      const viewport = $('.carousel-viewport', el);

      if (slides.length === 0) return;

      const state = {
        el,
        track,
        slides,
        viewport,
        current: 0,
        total: slides.length,
        isDragging: false,
        startX: 0,
        currentX: 0,
        dragOffset: 0,
      };

      carousels.push(state);

      // Set initial counter
      updateCounter(state, counter);

      // Arrow navigation
      prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        goToSlide(state, state.current - 1, counter);
      });

      nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        goToSlide(state, state.current + 1, counter);
      });

      // Click on slide → open lightbox
      slides.forEach((slide, index) => {
        slide.addEventListener('click', () => {
          if (state.isDragging) return;
          const photos = slides.map((s) => {
            const img = $('img', s);
            return { src: img.src, title: img.alt || '' };
          });
          openLightbox(photos, index, state.el.dataset.category);
        });
      });

      // Touch / pointer drag support
      initDrag(state, counter);
    });
  }

  function goToSlide(state, index, counter) {
    // Wrap around
    if (index < 0) index = state.total - 1;
    if (index >= state.total) index = 0;

    state.current = index;
    const offset = -(index * 100);
    state.track.style.transform = `translateX(${offset}%)`;
    state.track.classList.remove('is-dragging');

    if (counter) updateCounter(state, counter);
  }

  function updateCounter(state, counter) {
    if (!counter) return;
    const current = state.current + 1;
    counter.innerHTML = `<span class="counter-current">${current}</span> / ${state.total}`;
  }

  // -----------------------------------------------------------------------
  // Touch / Pointer Drag
  // -----------------------------------------------------------------------
  function initDrag(state, counter) {
    const viewport = state.viewport;
    let startX = 0;
    let startY = 0;
    let currentTranslate = 0;
    let isDragging = false;
    let hasMoved = false;
    let isHorizontal = null;

    function getClientX(e) {
      return e.touches ? e.touches[0].clientX : e.clientX;
    }

    function getClientY(e) {
      return e.touches ? e.touches[0].clientY : e.clientY;
    }

    function onStart(e) {
      isDragging = true;
      hasMoved = false;
      isHorizontal = null;
      startX = getClientX(e);
      startY = getClientY(e);
      currentTranslate = -(state.current * 100);
      state.track.classList.add('is-dragging');
    }

    function onMove(e) {
      if (!isDragging) return;

      const dx = getClientX(e) - startX;
      const dy = getClientY(e) - startY;

      // Determine direction on first significant movement
      if (isHorizontal === null && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
        isHorizontal = Math.abs(dx) > Math.abs(dy);
      }

      // If scrolling vertically, bail out
      if (isHorizontal === false) {
        isDragging = false;
        state.track.classList.remove('is-dragging');
        return;
      }

      if (isHorizontal) {
        e.preventDefault();
        hasMoved = true;
        const viewportWidth = viewport.offsetWidth;
        const percent = (dx / viewportWidth) * 100;
        state.track.style.transform = `translateX(${currentTranslate + percent}%)`;
      }
    }

    function onEnd(e) {
      if (!isDragging && !hasMoved) return;
      isDragging = false;

      const dx = (e.changedTouches ? e.changedTouches[0].clientX : e.clientX) - startX;
      const viewportWidth = viewport.offsetWidth;
      const threshold = viewportWidth * 0.15;

      state.isDragging = hasMoved;

      if (hasMoved && Math.abs(dx) > threshold) {
        if (dx < 0) {
          goToSlide(state, state.current + 1, counter);
        } else {
          goToSlide(state, state.current - 1, counter);
        }
      } else {
        // Snap back
        goToSlide(state, state.current, counter);
      }

      // Reset drag flag after a tick so click handler can check it
      setTimeout(() => { state.isDragging = false; }, 50);
    }

    // Touch events
    viewport.addEventListener('touchstart', onStart, { passive: true });
    viewport.addEventListener('touchmove', onMove, { passive: false });
    viewport.addEventListener('touchend', onEnd, { passive: true });

    // Mouse events (desktop drag)
    viewport.addEventListener('mousedown', (e) => {
      e.preventDefault();
      onStart(e);
    });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
  }

  // -----------------------------------------------------------------------
  // Lightbox
  // -----------------------------------------------------------------------
  let lightboxPhotos = [];
  let lightboxIndex = 0;
  let lightboxCategory = '';

  function openLightbox(photos, index, category) {
    lightboxPhotos = photos;
    lightboxIndex = index;
    lightboxCategory = category || '';
    updateLightboxContent();
    dom.lightbox.classList.add('is-open');
    dom.lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    dom.lightbox.classList.remove('is-open');
    dom.lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function updateLightboxContent() {
    const photo = lightboxPhotos[lightboxIndex];
    if (!photo) return;
    dom.lightboxImage.src = photo.src;
    dom.lightboxImage.alt = photo.title;

    // Format category name for display
    const categoryDisplay = lightboxCategory
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    dom.lightboxTitle.textContent = categoryDisplay;
    dom.lightboxCaption.textContent = `${lightboxIndex + 1} of ${lightboxPhotos.length}`;
  }

  function lightboxPrev() {
    lightboxIndex = (lightboxIndex - 1 + lightboxPhotos.length) % lightboxPhotos.length;
    updateLightboxContent();
  }

  function lightboxNext() {
    lightboxIndex = (lightboxIndex + 1) % lightboxPhotos.length;
    updateLightboxContent();
  }

  dom.lightboxClose.addEventListener('click', closeLightbox);
  dom.lightboxPrev.addEventListener('click', lightboxPrev);
  dom.lightboxNext.addEventListener('click', lightboxNext);

  dom.lightbox.addEventListener('click', (e) => {
    if (e.target === dom.lightbox || e.target === dom.lightbox.querySelector('.lightbox-content')) {
      closeLightbox();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (!dom.lightbox.classList.contains('is-open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') lightboxPrev();
    if (e.key === 'ArrowRight') lightboxNext();
  });

  // -----------------------------------------------------------------------
  // Scroll Reveal (Intersection Observer)
  // -----------------------------------------------------------------------
  let revealObserver;

  function observeReveals() {
    if (revealObserver) revealObserver.disconnect();

    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    $$('.reveal-up').forEach((el) => {
      if (!el.classList.contains('is-visible')) {
        revealObserver.observe(el);
      }
    });
  }

  // -----------------------------------------------------------------------
  // Navigation
  // -----------------------------------------------------------------------
  function handleNavScroll() {
    if (window.scrollY > 50) {
      dom.nav.classList.add('is-scrolled');
    } else {
      dom.nav.classList.remove('is-scrolled');
    }
  }

  window.addEventListener('scroll', handleNavScroll, { passive: true });

  // Mobile menu toggle
  dom.navToggle.addEventListener('click', () => {
    dom.navToggle.classList.toggle('is-active');
    dom.mobileMenu.classList.toggle('is-open');
  });

  // Close mobile menu on link click
  $$('.mobile-menu-link').forEach((link) => {
    link.addEventListener('click', () => {
      dom.navToggle.classList.remove('is-active');
      dom.mobileMenu.classList.remove('is-open');
    });
  });

  // Smooth scroll for anchor links (offset for fixed nav)
  $$('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const targetId = link.getAttribute('href');
      if (targetId === '#') return;
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        const offset = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-height')) || 72;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

  // -----------------------------------------------------------------------
  // Keyboard Navigation for Carousels
  // -----------------------------------------------------------------------
  document.addEventListener('keydown', (e) => {
    // Don't interfere with lightbox
    if (dom.lightbox.classList.contains('is-open')) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

    // Find which carousel is most in view
    let bestCarousel = null;
    let bestVisibility = 0;

    carousels.forEach((state) => {
      const rect = state.el.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const visible = Math.min(rect.bottom, windowHeight) - Math.max(rect.top, 0);
      const ratio = visible / rect.height;
      if (ratio > bestVisibility && ratio > 0.3) {
        bestVisibility = ratio;
        bestCarousel = state;
      }
    });

    if (bestCarousel) {
      const counter = $('.carousel-counter', bestCarousel.el);
      if (e.key === 'ArrowLeft') {
        goToSlide(bestCarousel, bestCarousel.current - 1, counter);
      } else {
        goToSlide(bestCarousel, bestCarousel.current + 1, counter);
      }
    }
  });

  // -----------------------------------------------------------------------
  // Contact Form
  // -----------------------------------------------------------------------
  dom.contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = dom.contactForm.querySelector('.form-submit');
    const originalText = btn.textContent;

    btn.textContent = 'Sending…';
    btn.disabled = true;

    try {
      const response = await fetch(dom.contactForm.action, {
        method: 'POST',
        body: new FormData(dom.contactForm),
        headers: { 'Accept': 'application/json' },
      });

      if (response.ok) {
        btn.textContent = 'Message Sent — Thank You!';
        btn.style.background = 'var(--color-oak)';
        dom.contactForm.reset();
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.background = '';
          btn.disabled = false;
        }, 3000);
      } else {
        throw new Error('Form submission failed');
      }
    } catch (err) {
      btn.textContent = 'Something went wrong — try again';
      btn.style.background = '#8B4040';
      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
        btn.disabled = false;
      }, 3000);
    }
  });

  // -----------------------------------------------------------------------
  // Footer Year
  // -----------------------------------------------------------------------
  dom.footerYear.textContent = new Date().getFullYear();

  // -----------------------------------------------------------------------
  // Init
  // -----------------------------------------------------------------------
  function init() {
    observeReveals();
    initCarousels();
    handleNavScroll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
