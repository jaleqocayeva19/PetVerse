const BAKU = [40.4093, 49.8671];

const spots = [
  {
    name: "Caspian Vet Clinic",
    category: "Veterinary",
    address: "Nizami Street 32, Baku",
    rating: 4.8,
    lat: 40.3779,
    lng: 49.8531,
  },
  {
    name: "Sabail Animal Hospital",
    category: "Veterinary",
    address: "Neftchilar Avenue 18, Icherisheher",
    rating: 4.6,
    lat: 40.3661,
    lng: 49.8372,
  },
  {
    name: "Fountain Square Pet Pharmacy",
    category: "24/7 Pharmacy",
    address: "Nizami Street 5, Fountain Square",
    rating: 4.7,
    lat: 40.3708,
    lng: 49.8389,
  },
  {
    name: "Narimanov Night Pharmacy",
    category: "24/7 Pharmacy",
    address: "Tbilisi Avenue 12, Narimanov",
    rating: 4.5,
    lat: 40.4098,
    lng: 49.8704,
  },
  {
    name: "Port Baku Grooming Studio",
    category: "Grooming",
    address: "Neftchilar Avenue 153, Port Baku",
    rating: 4.9,
    lat: 40.3756,
    lng: 49.8598,
  },
  {
    name: "Old City Paws Spa",
    category: "Grooming",
    address: "Asaf Zeynalli Street 8, Icherisheher",
    rating: 4.4,
    lat: 40.3654,
    lng: 49.8351,
  },
  {
    name: "Ganjlik Mall Pet Supplies",
    category: "Pet Supplies",
    address: "F. Amirov Street 1, Ganjlik Mall",
    rating: 4.3,
    lat: 40.4034,
    lng: 49.8726,
  },
  {
    name: "20 Yanvar Pet Market",
    category: "Pet Supplies",
    address: "Tbilisi Avenue 61, 20 Yanvar",
    rating: 4.2,
    lat: 40.4059,
    lng: 49.8108,
  },
];

const categoryColors = {
  Veterinary: "#0f766e",
  "24/7 Pharmacy": "#0369a1",
  Grooming: "#c026d3",
  "Pet Supplies": "#ca8a04",
};

let map;
let markerLayer;
let activeCategory = "All";

function initMap() {
  map = L.map("map", { scrollWheelZoom: true }).setView(BAKU, 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);
  renderMarkers();
  requestAnimationFrame(() => map.invalidateSize());
}

function markerIcon(category) {
  const color = categoryColors[category] || "#0f766e";
  return L.divIcon({
    className: "spot-pin",
    html: `<span style="background:${color}"></span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -12],
  });
}

function popupHtml(spot) {
  return `
    <div class="map-popup">
      <strong>${escapeHtml(spot.name)}</strong>
      <p>${escapeHtml(spot.category)}</p>
      <p>${escapeHtml(spot.address)}</p>
      <p class="popup-stars">★ ${Number(spot.rating).toFixed(1)}</p>
    </div>
  `;
}

function renderMarkers() {
  if (markerLayer) {
    markerLayer.remove();
  }
  markerLayer = L.layerGroup().addTo(map);

  spots
    .filter((spot) => activeCategory === "All" || spot.category === activeCategory)
    .forEach((spot) => {
      L.marker([spot.lat, spot.lng], { icon: markerIcon(spot.category) })
        .bindPopup(popupHtml(spot))
        .addTo(markerLayer);
    });
}

function bindFilters() {
  document.querySelectorAll(".filter-btn").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach((btn) => {
        btn.classList.toggle("is-active", btn === button);
      });
      activeCategory = button.dataset.category;
      renderMarkers();
    });
  });
}

function bindModal() {
  const dialog = document.getElementById("register-modal");
  const form = document.getElementById("register-form");
  const errorEl = document.getElementById("register-error");

  document.getElementById("open-register").addEventListener("click", () => {
    errorEl.hidden = true;
    dialog.showModal();
  });

  document.getElementById("close-register").addEventListener("click", () => {
    dialog.close();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const category = String(data.get("category") || "").trim();
    const address = String(data.get("address") || "").trim();
    const rating = Number(data.get("rating"));

    if (!name || !category || !address || Number.isNaN(rating)) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    errorEl.hidden = true;

    try {
      const coords = await geocodeAddress(address);
      const spot = { name, category, address, rating, ...coords };
      spots.push(spot);
      if (activeCategory !== "All" && activeCategory !== category) {
        activeCategory = "All";
        document.querySelectorAll(".filter-btn").forEach((btn) => {
          btn.classList.toggle("is-active", btn.dataset.category === "All");
        });
      }
      renderMarkers();
      map.setView([spot.lat, spot.lng], 14);
      L.popup()
        .setLatLng([spot.lat, spot.lng])
        .setContent(popupHtml(spot))
        .openOn(map);
      form.reset();
      dialog.close();
      showToast(`${name} added to the map`);
    } catch (error) {
      errorEl.textContent = error.message || "Could not add this spot.";
      errorEl.hidden = false;
    } finally {
      submitBtn.disabled = false;
    }
  });
}

async function geocodeAddress(address) {
  const query = `${address}, Baku, Azerbaijan`;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (response.ok) {
      const results = await response.json();
      if (results[0]) {
        return { lat: Number(results[0].lat), lng: Number(results[0].lon) };
      }
    }
  } catch {
    /* fall through to nearby Baku pin */
  }
  return {
    lat: BAKU[0] + (Math.random() - 0.5) * 0.05,
    lng: BAKU[1] + (Math.random() - 0.5) * 0.07,
  };
}

function bindNav() {
  document.getElementById("nav-ai-vet").addEventListener("click", (event) => {
    event.preventDefault();
    if (typeof window.openVetAdvisor === "function") {
      window.openVetAdvisor();
    }
  });
}

function bindSitters() {
  document.querySelectorAll(".btn-book").forEach((button) => {
    button.addEventListener("click", () => {
      const name = button.closest(".sitter-card").querySelector("h3").textContent;
      showToast(`Booking request sent to ${name}`);
    });
  });
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toast.hidden = true;
  }, 2800);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

initMap();
bindFilters();
bindModal();
bindNav();
bindSitters();
