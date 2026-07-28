// ============================================
// VAULTX - Frontend logic
// Sincronización cromática + countdown + waitlist
// ============================================

let countdownInterval = null;
let currentPieceId = null;

async function loadPieceOfTheDay() {
  try {
    const res = await fetch('/api/piece-of-the-day');
    const piece = await res.json();

    if (!piece) {
      return; // se queda el placeholder por defecto
    }

    currentPieceId = piece.id;

    document.getElementById('pieceName').textContent = piece.nombre;
    if (piece.descripcion) {
      document.getElementById('pieceDesc').textContent = piece.descripcion;
    }

    if (piece.imagen) {
      const img = document.getElementById('pieceImage');
      img.src = piece.imagen;
      img.alt = piece.nombre;
      img.style.display = 'block';
      document.getElementById('piecePlaceholder').style.display = 'none';
    }

    // Sincronización cromática por IA: aplica el color dominante de la pieza
    if (piece.color_dominante_hex) {
      applyAccentColor(piece.color_dominante_hex);
    }

    if (piece.fecha_drop) {
      startCountdown(new Date(piece.fecha_drop));
    }
  } catch (err) {
    console.error('[VaultX] Error cargando la pieza del día:', err.message);
  }
}

function applyAccentColor(hex) {
  document.documentElement.style.setProperty('--vx-accent', hex);
  document.documentElement.style.setProperty('--vx-accent-soft', hexToRgba(hex, 0.18));
}

function hexToRgba(hex, alpha) {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function startCountdown(targetDate) {
  if (countdownInterval) clearInterval(countdownInterval);

  function tick() {
    const now = new Date();
    const diff = targetDate - now;

    if (diff <= 0) {
      clearInterval(countdownInterval);
      document.getElementById('countdown').style.display = 'none';
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const mins = Math.floor((diff / (1000 * 60)) % 60);
    const secs = Math.floor((diff / 1000) % 60);

    document.getElementById('cdDays').textContent = String(days).padStart(2, '0');
    document.getElementById('cdHours').textContent = String(hours).padStart(2, '0');
    document.getElementById('cdMins').textContent = String(mins).padStart(2, '0');
    document.getElementById('cdSecs').textContent = String(secs).padStart(2, '0');
  }

  tick();
  countdownInterval = setInterval(tick, 1000);
}

// ============================================
// WAITLIST FORM
// ============================================
document.getElementById('waitlistForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const contact = document.getElementById('waitlistContact').value.trim();
  const msgEl = document.getElementById('waitlistMsg');

  if (!contact) return;

  try {
    const res = await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact, piece_id: currentPieceId })
    });

    if (res.ok) {
      msgEl.textContent = 'Listo — te avisaremos antes que a nadie.';
      document.getElementById('waitlistContact').value = '';
    } else {
      const data = await res.json();
      msgEl.textContent = data.error || 'Algo salió mal, intenta de nuevo.';
    }
  } catch (err) {
    msgEl.textContent = 'Error de conexión. Intenta de nuevo.';
  }
});

// ============================================
// INICIO
// ============================================
loadPieceOfTheDay();

const TRADUCCIONES = {
  es: {
    nav_drop: 'Drop Actual',
    nav_creator: 'El Rincón del Creador',
    nav_early: 'Early Access',
    piece_of_day: 'Pieza del día',
    days: 'días',
    hours: 'hrs',
    minutes: 'min',
    seconds: 'seg',
    waitlist_placeholder: 'Correo o WhatsApp',
    join_waitlist: 'Unirme a la lista',
    creator_corner_title: 'El Rincón del Creador'
  },
  en: {
    nav_drop: 'Current Drop',
    nav_creator: "Creator's Corner",
    nav_early: 'Early Access',
    piece_of_day: 'Piece of the Day',
    days: 'days',
    hours: 'hrs',
    minutes: 'min',
    seconds: 'sec',
    waitlist_placeholder: 'Email or WhatsApp',
    join_waitlist: 'Join the waitlist',
    creator_corner_title: "Creator's Corner"
  }
};

function aplicarTraducciones(idioma) {
  const dict = TRADUCCIONES[idioma] || TRADUCCIONES.es;

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) {
      el.textContent = dict[key];
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (dict[key]) {
      el.setAttribute('placeholder', dict[key]);
    }
  });

  document.documentElement.setAttribute('lang', idioma);
}

async function inicializarIdioma() {
  try {
    const res = await fetch('/api/detect-language');
    const data = await res.json();
    aplicarTraducciones(data.lang);
  } catch (err) {
    console.error('[VaultX] Error detectando idioma:', err.message);
    aplicarTraducciones('es');
  }
}

inicializarIdioma();

const FOMO_MENSAJES = {
  es: [
    { ciudad: 'Madrid', tipo: 'creador', texto: 'Un creador de {ciudad} se postuló hace {tiempo}' },
    { ciudad: 'Miami', tipo: 'waitlist', texto: 'Alguien en {ciudad} se acaba de unir a la lista' },
    { ciudad: 'Santo Domingo', tipo: 'waitlist', texto: 'Alguien en {ciudad} se acaba de unir a la lista' },
    { ciudad: 'Los Ángeles', tipo: 'creador', texto: 'Un creador de {ciudad} se postuló hace {tiempo}' },
    { ciudad: 'Nueva York', tipo: 'waitlist', texto: 'Alguien en {ciudad} se acaba de unir a la lista' }
  ],
  en: [
    { ciudad: 'Madrid', tipo: 'creador', texto: 'A creator from {ciudad} applied {tiempo} ago' },
    { ciudad: 'Miami', tipo: 'waitlist', texto: 'Someone in {ciudad} just joined the waitlist' },
    { ciudad: 'Santo Domingo', tipo: 'waitlist', texto: 'Someone in {ciudad} just joined the waitlist' },
    { ciudad: 'Los Angeles', tipo: 'creador', texto: 'A creator from {ciudad} applied {tiempo} ago' },
    { ciudad: 'New York', tipo: 'waitlist', texto: 'Someone in {ciudad} just joined the waitlist' }
  ]
};

const FOMO_TIEMPOS = { es: ['2 min', '3 min', '5 min', '8 min'], en: ['2 min', '3 min', '5 min', '8 min'] };

let idiomaActual = 'es';
let fomoInterval = null;

function mostrarFomoToast() {
  const toast = document.getElementById('fomoToast');
  if (!toast) return;

  const mensajes = FOMO_MENSAJES[idiomaActual] || FOMO_MENSAJES.es;
  const tiempos = FOMO_TIEMPOS[idiomaActual] || FOMO_TIEMPOS.es;
  const mensaje = mensajes[Math.floor(Math.random() * mensajes.length)];
  const tiempo = tiempos[Math.floor(Math.random() * tiempos.length)];

  const texto = mensaje.texto
    .replace('{ciudad}', mensaje.ciudad)
    .replace('{tiempo}', tiempo);

  toast.querySelector('.vx-fomo-toast__text').textContent = texto;
  toast.classList.add('vx-fomo-toast--visible');

  setTimeout(() => {
    toast.classList.remove('vx-fomo-toast--visible');
  }, 5000);
}

function iniciarFomoToasts() {
  setTimeout(mostrarFomoToast, 4000);
  fomoInterval = setInterval(mostrarFomoToast, 15000);
}

// Sobrescribe aplicarTraducciones para también sincronizar el idioma del FOMO
const aplicarTraduccionesOriginal = aplicarTraducciones;
aplicarTraducciones = function(idioma) {
  aplicarTraduccionesOriginal(idioma);
  idiomaActual = idioma;
};

iniciarFomoToasts();

window.addEventListener('load', () => {
  document.body.classList.add('vx-locked');
  setTimeout(() => {
    const cinematic = document.getElementById('vaultCinematic');
    if (cinematic) {
      cinematic.classList.add('vx-vault-cinematic--opening');
      setTimeout(() => {
        cinematic.remove();
        document.body.classList.remove('vx-locked');
      }, 1600);
    }
  }, 800);
});
