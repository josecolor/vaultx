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
