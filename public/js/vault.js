// ============================================
// VAULTX - Frontend logic
// Sincronización cromática + countdown + waitlist + Fomo + Diales Cinemática
// ============================================

let countdownInterval = null;
let currentPieceId = null;

async function loadPieceOfTheDay() {
  try {
    const res = await fetch('/api/piece-of-the-day');
    const piece = await res.json();
    if (!piece) return;

    currentPieceId = piece.id;
    document.getElementById('pieceName').textContent = piece.nombre;
    if (piece.descripcion) document.getElementById('pieceDesc').textContent = piece.descripcion;

    if (piece.imagen) {
      const img = document.getElementById('pieceImage');
      img.src = piece.imagen;
      img.alt = piece.nombre;
      img.style.display = 'block';
      const placeholder = document.getElementById('piecePlaceholder');
      if (placeholder) placeholder.style.display = 'none';
    }

    if (piece.color_dominante_hex) {
      document.documentElement.style.setProperty('--vx-accent', piece.color_dominante_hex);
    }
  } catch (err) {
    console.error('[VaultX] Error cargando pieza del día:', err.message);
  }
}

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
    if (dict[key]) el.textContent = dict[key];
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (dict[key]) el.setAttribute('placeholder', dict[key]);
  });
  document.documentElement.setAttribute('lang', idioma);
}

async function inicializarIdioma() {
  try {
    const res = await fetch('/api/detect-language');
    const data = await res.json();
    aplicarTraducciones(data.lang);
  } catch (err) {
    aplicarTraducciones('es');
  }
}

const FOMO_MENSAJES = {
  es: [
    { ciudad: 'Madrid', texto: 'Un creador de {ciudad} se postuló hace {tiempo}' },
    { ciudad: 'Miami', texto: 'Alguien en {ciudad} se acaba de unir a la lista' },
    { ciudad: 'Santo Domingo', texto: 'Alguien en {ciudad} se acaba de unir a la lista' }
  ],
  en: [
    { ciudad: 'Madrid', texto: 'A creator from {ciudad} applied {tiempo} ago' },
    { ciudad: 'Miami', texto: 'Someone in {ciudad} just joined the waitlist' },
    { ciudad: 'Santo Domingo', texto: 'Someone in {ciudad} just joined the waitlist' }
  ]
};

const FOMO_TIEMPOS = { es: ['2 min', '3 min', '5 min'], en: ['2 min', '3 min', '5 min'] };
let idiomaActual = 'es';

function mostrarFomoToast() {
  const toast = document.getElementById('fomoToast');
  if (!toast) return;
  const mensajes = FOMO_MENSAJES[idiomaActual] || FOMO_MENSAJES.es;
  const tiempos = FOMO_TIEMPOS[idiomaActual] || FOMO_TIEMPOS.es;
  const mensaje = mensajes[Math.floor(Math.random() * mensajes.length)];
  const tiempo = tiempos[Math.floor(Math.random() * tiempos.length)];
  toast.querySelector('.vx-fomo-toast__text').textContent = mensaje.texto.replace('{ciudad}', mensaje.ciudad).replace('{tiempo}', tiempo);
  toast.classList.add('vx-fomo-toast--visible');
  setTimeout(() => toast.classList.remove('vx-fomo-toast--visible'), 5000);
}

document.addEventListener('DOMContentLoaded', () => {
  loadPieceOfTheDay();
  inicializarIdioma();
  setTimeout(mostrarFomoToast, 4000);
  setInterval(mostrarFomoToast, 15000);

  document.body.classList.add('vx-locked');

  const dials = document.querySelectorAll('.vx-dial');
  dials.forEach(dial => {
    dial.addEventListener('click', () => {
      let currentVal = parseInt(dial.textContent);
      currentVal = (currentVal + 1) % 10;
      dial.textContent = currentVal;
      dial.style.transform = 'scale(0.95)';
      setTimeout(() => dial.style.transform = 'scale(1)', 150);
    });
  });

  const unlockBtn = document.getElementById('unlockVaultBtn');
  if (unlockBtn) {
    unlockBtn.addEventListener('click', () => {
      const cinematic = document.getElementById('vaultCinematic');
      if (cinematic) {
        cinematic.classList.add('vx-vault-cinematic--opening');
        setTimeout(() => {
          cinematic.remove();
          document.body.classList.remove('vx-locked');
        }, 1600);
      }
    });
  }
});
