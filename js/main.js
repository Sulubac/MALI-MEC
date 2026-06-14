/**
 * Urban Beach — Main JavaScript
 * Djibouti Seafood Restaurant
 */

'use strict';

/* ═══════════════════════════════════════════════════════
   LOADING SCREEN
════════════════════════════════════════════════════════ */
(function initLoader() {
  const loader = document.getElementById('loading-screen');
  if (!loader) return;

  // Hide loader after fonts + minimal delay
  const hideLoader = () => {
    loader.classList.add('hidden');
    document.body.style.overflow = '';
  };

  document.body.style.overflow = 'hidden';

  if (document.readyState === 'complete') {
    setTimeout(hideLoader, 1800);
  } else {
    window.addEventListener('load', () => setTimeout(hideLoader, 1800));
  }
})();


/* ═══════════════════════════════════════════════════════
   NAVBAR: scroll effect + active link
════════════════════════════════════════════════════════ */
(function initNavbar() {
  const navbar  = document.getElementById('navbar');
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('section[id]');

  if (!navbar) return;

  // Scroll → toggle .scrolled class
  const onScroll = () => {
    if (window.scrollY > 60) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
    highlightActiveLink();
    toggleScrollTop();
  };

  // Highlight nav link based on current section
  const highlightActiveLink = () => {
    let current = '';
    sections.forEach(sec => {
      const top = sec.offsetTop - 120;
      if (window.scrollY >= top) {
        current = sec.getAttribute('id');
      }
    });

    navLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === `#${current}`) {
        link.classList.add('active');
      }
    });
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // run once on load
})();


/* ═══════════════════════════════════════════════════════
   HAMBURGER MENU
════════════════════════════════════════════════════════ */
(function initHamburger() {
  const btn      = document.getElementById('hamburger');
  const navLinks = document.getElementById('nav-links');

  if (!btn || !navLinks) return;

  const toggle = (force) => {
    const isOpen = force !== undefined ? force : !navLinks.classList.contains('open');
    navLinks.classList.toggle('open', isOpen);
    btn.classList.toggle('open', isOpen);
    btn.setAttribute('aria-expanded', String(isOpen));
    document.body.style.overflow = isOpen ? 'hidden' : '';
  };

  btn.addEventListener('click', () => toggle());

  // Close when a link is clicked
  navLinks.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => toggle(false));
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (navLinks.classList.contains('open') &&
        !navLinks.contains(e.target) &&
        !btn.contains(e.target)) {
      toggle(false);
    }
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && navLinks.classList.contains('open')) {
      toggle(false);
      btn.focus();
    }
  });
})();


/* ═══════════════════════════════════════════════════════
   SMOOTH SCROLL
════════════════════════════════════════════════════════ */
(function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      const navH = document.getElementById('navbar')?.offsetHeight || 0;
      const top  = target.getBoundingClientRect().top + window.scrollY - navH;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
})();


/* ═══════════════════════════════════════════════════════
   HERO PARTICLES
════════════════════════════════════════════════════════ */
(function initParticles() {
  const container = document.getElementById('particles');
  if (!container) return;

  const colors = [
    'rgba(0,180,216,.6)',
    'rgba(144,224,239,.5)',
    'rgba(212,175,55,.4)',
    'rgba(255,255,255,.35)',
  ];

  const createParticle = () => {
    const p = document.createElement('div');
    p.classList.add('particle');
    const size = Math.random() * 12 + 4;           // 4–16px
    const left = Math.random() * 100;
    const dur  = Math.random() * 12 + 8;           // 8–20s
    const delay = Math.random() * 8;
    const color = colors[Math.floor(Math.random() * colors.length)];

    p.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      left: ${left}%;
      bottom: -20px;
      background: ${color};
      animation-duration: ${dur}s;
      animation-delay: ${delay}s;
      filter: blur(${size < 6 ? '1px' : '0px'});
    `;
    container.appendChild(p);

    // Remove after animation completes to avoid DOM bloat
    const totalMs = (dur + delay) * 1000;
    setTimeout(() => {
      p.remove();
      // Respawn
      if (container.isConnected) createParticle();
    }, totalMs);
  };

  // Spawn initial batch
  const count = window.innerWidth < 600 ? 18 : 35;
  for (let i = 0; i < count; i++) {
    setTimeout(() => createParticle(), i * 180);
  }
})();


/* ═══════════════════════════════════════════════════════
   SCROLL REVEAL (Intersection Observer)
════════════════════════════════════════════════════════ */
(function initReveal() {
  const targets = document.querySelectorAll('.reveal-up, .reveal-left, .reveal-right');
  if (!targets.length) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        io.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.12,
    rootMargin: '0px 0px -40px 0px',
  });

  targets.forEach(el => io.observe(el));
})();


/* ═══════════════════════════════════════════════════════
   STATS COUNTER ANIMATION
════════════════════════════════════════════════════════ */
(function initStats() {
  const counters = document.querySelectorAll('.stat-number');
  if (!counters.length) return;

  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  const animateCounter = (el) => {
    const target   = parseInt(el.dataset.target, 10);
    const isDecimal = el.classList.contains('stat-decimal');
    const duration  = 1800;
    const startTime = performance.now();

    const update = (currentTime) => {
      const elapsed  = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const value    = Math.floor(easeOut(progress) * target);

      if (isDecimal) {
        // target 49 → display 4.9
        el.textContent = (value / 10).toFixed(1);
      } else {
        el.textContent = value.toLocaleString('fr-FR');
      }

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        el.textContent = isDecimal
          ? (target / 10).toFixed(1)
          : target.toLocaleString('fr-FR');
      }
    };

    requestAnimationFrame(update);
  };

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.4 });

  counters.forEach(el => io.observe(el));
})();


/* ═══════════════════════════════════════════════════════
   TESTIMONIALS CAROUSEL
════════════════════════════════════════════════════════ */
(function initTestimonials() {
  const track    = document.getElementById('testimonials-track');
  const dots     = document.querySelectorAll('.dot');
  const prevBtn  = document.getElementById('prev-testimonial');
  const nextBtn  = document.getElementById('next-testimonial');

  if (!track) return;

  const cards    = track.querySelectorAll('.testimonial-card');
  const total    = cards.length;
  let current    = 0;
  let autoTimer  = null;

  const goTo = (index) => {
    current = (index + total) % total;
    track.style.transform = `translateX(-${current * 100}%)`;
    dots.forEach((dot, i) => dot.classList.toggle('active', i === current));
  };

  const next = () => goTo(current + 1);
  const prev = () => goTo(current - 1);

  const startAuto = () => {
    stopAuto();
    autoTimer = setInterval(next, 5000);
  };

  const stopAuto = () => {
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
  };

  // Button listeners
  nextBtn?.addEventListener('click', () => { next(); startAuto(); });
  prevBtn?.addEventListener('click', () => { prev(); startAuto(); });

  // Dot listeners
  dots.forEach(dot => {
    dot.addEventListener('click', () => {
      goTo(parseInt(dot.dataset.index, 10));
      startAuto();
    });
  });

  // Touch / swipe support
  let touchStartX = 0;

  track.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    stopAuto();
  }, { passive: true });

  track.addEventListener('touchend', (e) => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      diff > 0 ? next() : prev();
    }
    startAuto();
  }, { passive: true });

  // Pause on hover
  track.parentElement?.addEventListener('mouseenter', stopAuto);
  track.parentElement?.addEventListener('mouseleave', startAuto);

  // Start
  startAuto();
})();


/* ═══════════════════════════════════════════════════════
   SCROLL-TO-TOP BUTTON
════════════════════════════════════════════════════════ */
function toggleScrollTop() {
  const btn = document.getElementById('scroll-top');
  if (!btn) return;
  btn.classList.toggle('visible', window.scrollY > 300);
}

(function initScrollTop() {
  const btn = document.getElementById('scroll-top');
  if (!btn) return;

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  window.addEventListener('scroll', toggleScrollTop, { passive: true });
})();


/* ═══════════════════════════════════════════════════════
   RESERVATION FORM VALIDATION
════════════════════════════════════════════════════════ */
(function initForm() {
  const form = document.getElementById('reservation-form');
  if (!form) return;

  const rules = {
    prenom:   { required: true, minLength: 2, label: 'Le prénom' },
    nom:      { required: true, minLength: 2, label: 'Le nom' },
    email:    { required: true, email: true,  label: 'L\'email' },
    tel:      { required: true, tel: true,    label: 'Le téléphone' },
    date:     { required: true, future: true, label: 'La date' },
    heure:    { required: true, label: 'L\'heure' },
    personnes:{ required: true, label: 'Le nombre de personnes' },
  };

  const validate = (name, value) => {
    const rule = rules[name];
    if (!rule) return '';

    if (rule.required && !value.trim()) {
      return `${rule.label} est requis(e).`;
    }

    if (rule.minLength && value.trim().length < rule.minLength) {
      return `${rule.label} doit comporter au moins ${rule.minLength} caractères.`;
    }

    if (rule.email && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return 'Veuillez entrer une adresse email valide.';
    }

    if (rule.tel && value && !/^[\d\s\+\-\(\)]{6,}$/.test(value)) {
      return 'Veuillez entrer un numéro de téléphone valide.';
    }

    if (rule.future && value) {
      const selected = new Date(value);
      const today    = new Date();
      today.setHours(0, 0, 0, 0);
      if (selected < today) {
        return 'Veuillez choisir une date future.';
      }
    }

    return '';
  };

  const showError = (name, message) => {
    const input = form.querySelector(`[name="${name}"]`);
    const errEl = document.getElementById(`${name}-error`);
    const group = input?.closest('.form-group');

    if (errEl) errEl.textContent = message;
    if (group) {
      group.classList.toggle('has-error', !!message);
    }
  };

  const clearError = (name) => showError(name, '');

  // Live validation
  Object.keys(rules).forEach(name => {
    const input = form.querySelector(`[name="${name}"]`);
    if (!input) return;
    input.addEventListener('blur', () => {
      showError(name, validate(name, input.value));
    });
    input.addEventListener('input', () => {
      if (form.querySelector(`#${name}-error`)?.textContent) {
        showError(name, validate(name, input.value));
      }
    });
  });

  // Submit
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    let valid = true;

    Object.keys(rules).forEach(name => {
      const input = form.querySelector(`[name="${name}"]`);
      if (!input) return;
      const msg = validate(name, input.value);
      showError(name, msg);
      if (msg) valid = false;
    });

    if (!valid) {
      // Scroll to first error
      const firstErr = form.querySelector('.has-error');
      firstErr?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // Simulate submission
    const btnText    = form.querySelector('.btn-text');
    const btnLoading = form.querySelector('.btn-loading');
    const submitBtn  = form.querySelector('.btn-submit');

    if (btnText)    btnText.style.display    = 'none';
    if (btnLoading) btnLoading.style.display = '';
    if (submitBtn)  submitBtn.disabled       = true;

    setTimeout(() => {
      if (btnText)    btnText.style.display    = '';
      if (btnLoading) btnLoading.style.display = 'none';
      if (submitBtn)  submitBtn.disabled       = false;

      const successEl = document.getElementById('form-success');
      if (successEl) {
        successEl.style.display = 'block';
        successEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      form.reset();
      Object.keys(rules).forEach(name => clearError(name));

      // Hide success message after 6 seconds
      setTimeout(() => {
        if (successEl) successEl.style.display = 'none';
      }, 6000);
    }, 1800);
  });
})();


/* ═══════════════════════════════════════════════════════
   RIPPLE EFFECT ON BUTTONS
════════════════════════════════════════════════════════ */
(function initRipple() {
  document.querySelectorAll('.ripple').forEach(btn => {
    btn.addEventListener('click', function (e) {
      const rect   = this.getBoundingClientRect();
      const x      = e.clientX - rect.left;
      const y      = e.clientY - rect.top;
      const ripple = document.createElement('span');

      ripple.style.cssText = `
        position: absolute;
        width: 2px; height: 2px;
        background: rgba(255,255,255,.45);
        border-radius: 50%;
        left: ${x}px; top: ${y}px;
        transform: translate(-50%,-50%) scale(0);
        animation: rippleAnim .65s ease-out forwards;
        pointer-events: none;
      `;

      this.style.position = this.style.position || 'relative';
      this.style.overflow = 'hidden';
      this.appendChild(ripple);

      ripple.addEventListener('animationend', () => ripple.remove());
    });
  });

  // Inject ripple keyframes dynamically
  const style = document.createElement('style');
  style.textContent = `
    @keyframes rippleAnim {
      to { transform: translate(-50%,-50%) scale(200); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
})();


/* ═══════════════════════════════════════════════════════
   PARALLAX LITE on hero background
════════════════════════════════════════════════════════ */
(function initParallax() {
  const hero = document.querySelector('.hero');
  if (!hero) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const update = () => {
    const scrollY = window.scrollY;
    if (scrollY < window.innerHeight) {
      hero.style.backgroundPositionY = `${scrollY * 0.35}px`;
    }
  };

  window.addEventListener('scroll', update, { passive: true });
})();


/* ═══════════════════════════════════════════════════════
   MENU CARD "COMMANDER" button micro-interaction
════════════════════════════════════════════════════════ */
(function initMenuButtons() {
  document.querySelectorAll('.btn-menu').forEach(btn => {
    btn.addEventListener('click', function () {
      const original = this.textContent;
      this.textContent = '✓ Ajouté';
      this.style.background = 'rgba(0,200,100,.2)';
      this.style.borderColor = 'rgba(0,200,100,.5)';
      this.style.color       = '#5dde8a';
      this.disabled          = true;

      setTimeout(() => {
        this.textContent       = original;
        this.style.background  = '';
        this.style.borderColor = '';
        this.style.color       = '';
        this.disabled          = false;
      }, 2200);
    });
  });
})();


/* ═══════════════════════════════════════════════════════
   SET MINIMUM DATE for reservation form
════════════════════════════════════════════════════════ */
(function setMinDate() {
  const dateInput = document.getElementById('date');
  if (!dateInput) return;

  const today = new Date();
  const yyyy  = today.getFullYear();
  const mm    = String(today.getMonth() + 1).padStart(2, '0');
  const dd    = String(today.getDate()).padStart(2, '0');
  dateInput.min = `${yyyy}-${mm}-${dd}`;
})();


/* ═══════════════════════════════════════════════════════
   FOOTER "Ouvert maintenant" dynamic status
════════════════════════════════════════════════════════ */
(function initOpenStatus() {
  const badge = document.querySelector('.footer-open-badge');
  if (!badge) return;

  const now   = new Date();
  const day   = now.getDay();    // 0=Sun, 1=Mon, ..., 6=Sat
  const hour  = now.getHours();
  const min   = now.getMinutes();
  const time  = hour + min / 60;

  let openH = 11, closeH = 23;

  if (day === 0) { openH = 10; closeH = 23; }              // Sunday
  else if (day === 5 || day === 6) { openH = 11; closeH = 24; } // Fri/Sat

  const isOpen = time >= openH && time < closeH;

  const dot = badge.querySelector('.open-dot');

  if (!isOpen) {
    badge.style.background  = 'rgba(200,50,50,.15)';
    badge.style.borderColor = 'rgba(200,50,50,.3)';
    badge.style.color       = '#f87171';
    if (dot) {
      dot.style.background = '#f87171';
      dot.style.animation  = 'none';
    }
    badge.lastChild.textContent = ' Fermé actuellement';
  }
})();
