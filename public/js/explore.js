/* ==========================================================
   explore.js — dynamic restaurant grid + detail panel
   ========================================================== */

document.addEventListener("DOMContentLoaded", () => {
  loadRestaurants();
  loadWeeklyTopRestaurants();
  setupOpenNowFilter();
  setupReviewsFilter();
  setupReviewRatingFilter();
  setupLiveSearch();
});

let allRestaurants = [];
let openNowOnly = false;
let reviewsOnly = false;
let ratingOnly = false;
let searchQuery = "";


/* ── 1. Fetch all restaurants and render cards ── */
async function loadRestaurants() {
  const grid = document.getElementById("restaurantGrid");

  try {
    const res = await fetch("/api/restaurants");
    if (!res.ok) throw new Error("Failed to load restaurants");
    const data = await res.json();

    /* grid.innerHTML = ""; // clear any placeholder content

    if (!data.restaurants || data.restaurants.length === 0) {
      grid.innerHTML = `<div class="no-results">No restaurants found yet. <a href="restaurantform.html">Be the first to submit one!</a></div>`;
      return;
    }

    data.restaurants.forEach(r => {
      const card = buildCard(r);
      grid.appendChild(card);
    }); */

    allRestaurants = data.restaurants || [];
    //renderRestaurants(allRestaurants);
    applyFilters();

  } catch (err) {
    console.error(err);
    grid.innerHTML = `<div class="no-results">Could not load restaurants. Please try again later.</div>`;
  }
}

function setupLiveSearch() {
  const searchInput = document.getElementById("searchInput");
  if (!searchInput) return;

  searchInput.addEventListener("input", () => {
    searchQuery = searchInput.value.trim().toLowerCase();
    applyFilters()
  });
}

function applyFilters() {
  let filtered = [...allRestaurants];

  if (searchQuery) {
    filtered = filtered.filter(restaurant => {
      const name = (restaurant.restaurantName || "").toLowerCase();
      return name.includes(searchQuery);
    });
  }

  if (openNowOnly) {
    filtered = filtered.filter(getOpenStatus);
  }

  renderRestaurants(filtered);
}


async function loadWeeklyTopRestaurants() {
  const container = document.getElementById("weeklyTopRestaurants");
  if (!container) return;

  container.innerHTML = `<div class="weekly-top-empty">Loading weekly rankings...</div>`;

  try {
    const restaurantRes = await fetch("/api/restaurants");
    if (!restaurantRes.ok) throw new Error("Failed to load restaurants");

    const restaurantData = await restaurantRes.json();
    const restaurants = restaurantData.restaurants || [];

    if (!restaurants.length) {
      container.innerHTML = `<div class="weekly-top-empty">No restaurants found.</div>`;
      return;
    }

    const restaurantStats = await Promise.all(
      restaurants.map(async (restaurant) => {
        try {
          const reviewRes = await fetch(`/api/reviews/${restaurant.restaurant_ID}`);
          if (!reviewRes.ok) throw new Error("Failed reviews fetch");

          const reviewData = await reviewRes.json();
          const reviews = reviewData.reviews || [];

          const weeklyReviews = reviews.filter(review => {
            const reviewDate = getReviewDate(review);
            return isInCurrentWeek(reviewDate);
          });

          const ratingsThisWeek = weeklyReviews
            .map(review => Number(review.stars))
            .filter(stars => !Number.isNaN(stars) && stars > 0);

          const avgRatingThisWeek = ratingsThisWeek.length
            ? ratingsThisWeek.reduce((sum, stars) => sum + stars, 0) / ratingsThisWeek.length
            : 0;

          return {
            restaurant_ID: restaurant.restaurant_ID,
            restaurantName: restaurant.restaurantName,
            totalReviews: reviews.length,
            reviewsThisWeek: weeklyReviews.length,
            avgRatingThisWeek
          };
        } catch (err) {
          console.error(`Weekly stats failed for restaurant ${restaurant.restaurant_ID}`, err);
          return {
            restaurant_ID: restaurant.restaurant_ID,
            restaurantName: restaurant.restaurantName,
            totalReviews: 0,
            reviewsThisWeek: 0,
            avgRatingThisWeek: 0
          };
        }
      })
    );

    // Current behavior: rank by THIS WEEK'S review count
    const topRestaurants = restaurantStats
      .filter(r => r.reviewsThisWeek > 0)
      .sort((a, b) => {
        if (b.reviewsThisWeek !== a.reviewsThisWeek) {
          return b.reviewsThisWeek - a.reviewsThisWeek;
        }
        return b.avgRatingThisWeek - a.avgRatingThisWeek;
      })
      .slice(0, 5);

    if (!topRestaurants.length) {
      container.innerHTML = `<div class="weekly-top-empty">No reviews were added for restaurants this week.</div>`;
      return;
    }

    container.innerHTML = topRestaurants.map((restaurant, index) => `
      <div class="weekly-top-item">
        <div class="weekly-top-rank">#${index + 1}</div>
        <div class="weekly-top-content">
          <a href="restaurant.html?id=${restaurant.restaurant_ID}" class="weekly-top-name">
              ${escHtml(restaurant.restaurantName)}
            </a>
          <div class="weekly-top-meta">
            <span>${restaurant.reviewsThisWeek} review${restaurant.reviewsThisWeek === 1 ? "" : "s"} this week</span>
            <span>•</span>
            <span>${renderStars(restaurant.avgRatingThisWeek)} (${restaurant.avgRatingThisWeek.toFixed(1)})</span>
          </div>
        </div>
      </div>
    `).join("");

  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="weekly-top-empty">Could not load weekly top restaurants.</div>`;
  }
}

/* ── 2. Build a single restaurant card element ── */
function buildCard(r) {
  const card = document.createElement("div");
  card.className = "explore-card restaurant-card";
  card.dataset.id = r.restaurant_ID;

  // Use the first photo if available, otherwise a placeholder
  const imgUrl = r.photos && r.photos.length > 0
    ? r.photos[0]
    : "/images/PlatedLogo.png";

  // Parse tags for category display (tags stored as comma-separated string)
  const categoryText = r.tags
    ? r.tags.split(",").map(t => t.trim()).slice(0, 3).join(" • ")
    : "Restaurant";

  // Compute star display from average rating
  const stars = r.avg_rating ? renderStars(parseFloat(r.avg_rating)) : "No ratings yet";
  const ratingLabel = r.avg_rating
    ? `${stars} (${parseFloat(r.avg_rating).toFixed(1)})`
    : stars;

  card.innerHTML = `
    <div class="restaurant-image" style="background-image:url('${imgUrl}');"></div>
    <div class="restaurant-details">
      <div class="restaurant-name">${escHtml(r.restaurantName)}</div>
      <div class="rating">${ratingLabel}</div>
      <div class="category">${escHtml(categoryText)}</div>
      <div style="display:flex; gap:8px; align-items:center; margin-top:auto;">
        <div class="address-preview">${escHtml(r.address || "")}</div>
      </div>
    </div>
  `;

  card.addEventListener("click", () => openDetailPanel(r.restaurant_ID));
  return card;
}

/* ── 3. Open the slide-in detail panel ── */
async function openDetailPanel(id) {
  const panel   = document.getElementById("detailPanel");
  const overlay = document.getElementById("detailOverlay");
  const body    = document.getElementById("detailBody");

  // Show panel immediately with a loading spinner
  panel.classList.add("open");
  overlay.classList.add("open");
  document.body.classList.add("panel-open");
  body.innerHTML = `<div class="loader"></div>`;

  try {
    // Fetch restaurant detail and reviews in parallel
    const [rRes, revRes, photoRes] = await Promise.all([
      fetch(`/api/restaurants/${id}`),
      fetch(`/api/reviews/${id}`),
      fetch(`/api/restaurants/${id}/photos`)
    ]);

    const rData    = rRes.ok    ? await rRes.json()   : null;
    const revData  = revRes.ok  ? await revRes.json() : { reviews: [] };
    const photoData = photoRes.ok ? await photoRes.json() : { photos: [] };

    if (!rData) {
      body.innerHTML = `<p class="no-results">Could not load restaurant details.</p>`;
      return;
    }

    const uploadedPhotosFromDetail = Array.isArray(rData.restaurant?.photos)
  ? rData.restaurant.photos
  : [];

    const uploadedPhotosFromPhotoRoute = Array.isArray(photoData.photos)
      ? photoData.photos
      : [];

    const reviewPhotos = (revData.reviews || []).flatMap(review =>
      Array.isArray(review.photos) ? review.photos : []
    );

    const mergedRestaurant = {
      ...rData.restaurant,
      photos: [
        ...new Set([
          ...uploadedPhotosFromDetail,
          ...uploadedPhotosFromPhotoRoute,
          ...reviewPhotos
        ])
      ]
    };

    body.innerHTML = buildDetailHTML(mergedRestaurant, revData.reviews || []);

    // Wire up photo carousel navigation if there are multiple photos
    initCarousel();

  } catch (err) {
    console.error(err);
    body.innerHTML = `<p class="no-results">An error occurred. Please try again.</p>`;
  }
}

/* ── 4. Build the inner HTML for the detail panel ── */
function buildDetailHTML(r, reviews) {
  /* ---- Photos ---- */
  const photos = r.photos && r.photos.length > 0 ? r.photos : [];
  const photoSection = photos.length > 0
    ? `
      <div class="dp-carousel">
        <div class="dp-carousel-track" id="carouselTrack">
          ${photos.map((p, i) =>
            `<img src="${escHtml(p)}" alt="Photo ${i + 1}" class="dp-carousel-img ${i === 0 ? 'active' : ''}" />`
          ).join("")}
        </div>
        ${photos.length > 1 ? `
          <button class="carousel-btn prev" id="carouselPrev" aria-label="Previous photo">&#8249;</button>
          <button class="carousel-btn next" id="carouselNext" aria-label="Next photo">&#8250;</button>
          <div class="carousel-dots" id="carouselDots">
            ${photos.map((_, i) =>
              `<span class="dot ${i === 0 ? 'active' : ''}" data-index="${i}"></span>`
            ).join("")}
          </div>
        ` : ""}
      </div>
    `
    : `<div class="dp-no-photo">No photos yet</div>`;

  /* ---- Hours ---- */
  const days = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
  const dayLabels = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
  const anyHours = days.some(d => r[`${d}Hours`]);
  const hoursSection = anyHours ? `
    <div class="dp-section">
      <h3 class="dp-section-title">Hours</h3>
      <ul class="dp-hours-list">
        ${days.map((d, i) => r[`${d}Hours`]
          ? `<li><span class="day-label">${dayLabels[i]}</span><span>${escHtml(r[`${d}Hours`])}</span></li>`
          : ""
        ).join("")}
      </ul>
    </div>
  ` : "";

  /* ---- Amenities / Tags ---- */
  const tagsHtml = r.tags
    ? r.tags.split(",").map(t => `<span class="dp-tag">${escHtml(t.trim())}</span>`).join("")
    : "";

  const amenitiesHtml = r.amenities
    ? r.amenities.split(",").map(a => `<span class="dp-tag secondary">${escHtml(a.trim())}</span>`).join("")
    : "";

  /* ---- Reviews ---- */
  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, rv) => sum + (rv.stars || 0), 0) / reviews.filter(rv => rv.stars).length)
    : null;

  const reviewsSection = reviews.length > 0
    ? reviews.map(rv => `
        <div class="dp-review">
          <div class="dp-review-header">
            ${rv.profile_photo
              ? `<img src="${rv.profile_photo}" class="dp-avatar dp-avatar-photo" alt="" />`
              : `<span class="dp-avatar">${escHtml(rv.initials || "?")}</span>`
            }
            <div>
              <strong>${escHtml(rv.username || "Anonymous")}</strong>
              <span class="dp-review-date">${rv.visit_date ? formatDate(rv.visit_date) : ""}</span>
            </div>
            ${rv.stars ? `<span class="dp-stars">${renderStars(rv.stars)}</span>` : ""}
          </div>
          ${rv.notes ? `<p class="dp-review-notes">${escHtml(rv.notes)}</p>` : ""}
          ${rv.favorite_dishes ? `<p class="dp-review-dishes">🍽 <em>${escHtml(rv.favorite_dishes)}</em></p>` : ""}
          ${rv.photos && rv.photos.length > 0
            ? `<div class="dp-review-photos">${rv.photos.map(p => `<img src="${escHtml(p)}" alt="Review photo" />`).join("")}</div>`
            : ""}
        </div>
      `).join("")
    : `<p class="no-results" style="padding:0">No reviews yet. <a href="review.html?id=${r.restaurant_ID}&name=Loading%2520Title">Be the first!</a></p>`;

  /* ---- Assemble ---- */
  return `
    ${photoSection}

    <div class="dp-content">
      <div class="dp-header">
        <div>
          <h2 class="dp-name">
            <a href="restaurant.html?id=${r.restaurant_ID}" class="dp-name-link">
              ${escHtml(r.restaurantName)}
            </a>
          </h2>
          ${avgRating
            ? `<div class="dp-rating">${renderStars(avgRating)} <span>${avgRating.toFixed(1)} · ${reviews.filter(rv => rv.stars).length} review${reviews.filter(rv => rv.stars).length !== 1 ? "s" : ""}</span></div>`
            : `<div class="dp-rating">No ratings yet</div>`
          }
        </div>
        <a href="review.html?id=${r.restaurant_ID}&name=Loading%2520Title" class="btn secondary dp-edit-btn">Write a Review</a>
      </div>

      ${tagsHtml ? `<div class="dp-tags">${tagsHtml}</div>` : ""}

      ${r.about ? `
        <div class="dp-section">
          <h3 class="dp-section-title">About</h3>
          <p>${escHtml(r.about)}</p>
        </div>
      ` : ""}

      <div class="dp-info-grid">
        ${r.address ? `
          <div class="dp-info-item">
            <span class="dp-info-icon">📍</span>
            <span>${escHtml(r.address)}</span>
          </div>
        ` : ""}
        ${r.phone ? `
          <div class="dp-info-item">
            <span class="dp-info-icon">📞</span>
            <a href="tel:${escHtml(r.phone)}">${escHtml(r.phone)}</a>
          </div>
        ` : ""}
        ${r.website ? `
          <div class="dp-info-item">
            <span class="dp-info-icon">🌐</span>
            <a href="${escHtml(r.website)}" target="_blank" rel="noopener">${escHtml(r.website)}</a>
          </div>
        ` : ""}
        ${r.timeToVisit ? `
          <div class="dp-info-item">
            <span class="dp-info-icon">⏱</span>
            <span>Best time: ${escHtml(r.timeToVisit)}</span>
          </div>
        ` : ""}
      </div>

      ${hoursSection}

      ${amenitiesHtml ? `
        <div class="dp-section">
          <h3 class="dp-section-title">Amenities</h3>
          <div class="dp-tags">${amenitiesHtml}</div>
        </div>
      ` : ""}

      ${r.notes ? `
        <div class="dp-section">
          <h3 class="dp-section-title">Notes</h3>
          <p>${escHtml(r.notes)}</p>
        </div>
      ` : ""}

      <div class="dp-section">
        <h3 class="dp-section-title">Reviews</h3>
        <div class="dp-reviews-list">${reviewsSection}</div>
      </div>
    </div>
  `;
}

/* ── 5. Photo carousel ── */
function initCarousel() {
  const track  = document.getElementById("carouselTrack");
  const prev   = document.getElementById("carouselPrev");
  const next   = document.getElementById("carouselNext");
  const dots   = document.querySelectorAll("#carouselDots .dot");

  if (!track || !prev || !next) return;

  const imgs   = track.querySelectorAll(".dp-carousel-img");
  let current  = 0;

  function goTo(idx) {
    imgs[current].classList.remove("active");
    dots[current]?.classList.remove("active");
    current = (idx + imgs.length) % imgs.length;
    imgs[current].classList.add("active");
    dots[current]?.classList.add("active");
  }

  prev.addEventListener("click", () => goTo(current - 1));
  next.addEventListener("click", () => goTo(current + 1));
  dots.forEach(dot => dot.addEventListener("click", () => goTo(parseInt(dot.dataset.index))));
}

/* ── 6. Close panel ── */
function closeDetailPanel() {
  document.getElementById("detailPanel").classList.remove("open");
  document.getElementById("detailOverlay").classList.remove("open");
  document.body.classList.remove("panel-open");
}

// Expose to inline onclick in HTML
window.closeDetailPanel = closeDetailPanel;

/* ── Render Restaurants ── */
function renderRestaurants(restaurants) {
  const grid = document.getElementById("restaurantGrid");
  grid.innerHTML = "";

  // if (count) {
  //   count.textContent = `${restaurants.length} restaurant${restaurants.length === 1 ? "" : "s"}`;
  // }

  // if (!restaurants || restaurants.length === 0) {
  //   grid.innerHTML = `<div class="no-results">No Restaurants Found.🥺 
  //     <a href="restaurantform.html"> 
  //     Be the first to submit one!
  //     </a>
  //   </div>`;
  //   return;
  // }

  if (!restaurants || restaurants.length === 0) {
    grid.innerHTML = `<div class="no-results no-results--with-rec">
      <div>No Restaurants Found.🥺</div>
      <a href="restaurantform.html"> 
      Be the first to submit one!
      </a>
      <div class="no-reuslts-sub">...but we think you'll like this:</div>
    </div>
    `;
    
    // pick a random restaurant from allRestaurants
    if (allRestaurants.length > 0) {
      const random = 
        allRestaurants[Math.floor(Math.random() * allRestaurants.length)];

      const recCard = buildCard(random);
      const wrapper = document.createElement("div");
      wrapper.className = "recommended-card-wrap";
      wrapper.appendChild(recCard);

      grid.appendChild(wrapper);
    }
    
    return;
  }

  restaurants.forEach(r => {
    const card = buildCard(r);
    grid.appendChild(card);
  });
}

/* ── Filter Restaurants by Open Now button and review ── */
function setupOpenNowFilter() {
  const btn = document.getElementById("openNowBtn");
  if (!btn) return;

  btn.addEventListener("click", () => {
    openNowOnly = !openNowOnly;
    btn.classList.toggle("active", openNowOnly);
    applyFilters();

    // if (openNowOnly) {
    //   const filtered = allRestaurants.filter(getOpenStatus);
    //   renderRestaurants(filtered);
    // } else {
    //   renderRestaurants(allRestaurants);
    // }
  });
}

function setupReviewsFilter() {
  const btn = document.getElementById("reviewsBtn");
  if (!btn) return;

  btn.addEventListener("click", () => {
    reviewsOnly = !reviewsOnly;
    btn.classList.toggle("active", reviewsOnly);

    if (reviewsOnly) {
      const sorted = [...allRestaurants].sort(
        (a, b) => Number(b.review_count || 0) - Number(a.review_count || 0)
      );
      renderRestaurants(sorted);
    } else {
      renderRestaurants(allRestaurants);
    }
  });
}

function setupReviewRatingFilter() {
  const btn = document.getElementById("reviewsRateBtn");
  if (!btn) return;

  // let ratingOnly = false;

  btn.addEventListener("click", () => {
    ratingOnly = !ratingOnly;
    btn.classList.toggle("active", ratingOnly);

    if (ratingOnly) {
      const sorted = [...allRestaurants].sort(
        (a, b) => Number(b.avg_rating || 0) - Number(a.avg_rating || 0)
      );
      renderRestaurants(sorted);
    } else {
      renderRestaurants(allRestaurants);
    }
  });
}

// console.log("All restaurants:", allRestaurants);

// const filtered = allRestaurants.filter(restaurant => {
//   const todayHours = getTodayHours(restaurant);
//   console.log("Checking:", restaurant.restaurantName, todayHours);
//   return isOpenNow(todayHours);
// });

// console.log("Filtered result:", filtered);


function getTodayHours(restaurant) {
  const todayIndex = new Date().getDay(); // 0 = Sun, 6 = Sat

  const hoursMap = [
    restaurant.sundayHours,
    restaurant.mondayHours,
    restaurant.tuesdayHours,
    restaurant.wednesdayHours,
    restaurant.thursdayHours,
    restaurant.fridayHours,
    restaurant.saturdayHours
  ];

  return hoursMap[todayIndex] || null;
}

function isOpenNow(hoursString) {
  if (!hoursString) return false;

  const cleaned = String(hoursString).trim();
  const parts = cleaned.split(",");

  if (parts.length !== 2) return false;

  const [open, close] = parts.map(s => s.trim());
  if (!open || !close) return false;

  const now = new Date();
  // now.setHours(13, 0, 0, 0); // test time, 1 PM

  const [openH, openM] = open.split(":").map(Number);
  const [closeH, closeM] = close.split(":").map(Number);

  if ([openH, openM, closeH, closeM].some(Number.isNaN)) {
    return false;
  }

  const openTime = new Date();
  openTime.setHours(openH, openM, 0, 0);

  const closeTime = new Date();
  closeTime.setHours(closeH, closeM, 0, 0);

  return now >= openTime && now <= closeTime;
}

function getOpenStatus(restaurant) {
  const todayHours = getTodayHours(restaurant);
  console.log("Open Now check:", restaurant.restaurantName, todayHours);
  // console.log(allRestaurants[0].mondayHours);
  return isOpenNow(todayHours);
}

function getReviewDate(review) {
  return review.created_at || review.review_date || review.visit_date || null;
}

function isInCurrentWeek(dateStr) {
  if (!dateStr) return false;

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday start

  return date >= startOfWeek && date <= now;
}



/* ── Utilities ── */
function escHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderStars(n) {
  const full  = Math.round(n);
  let out = "";
  for (let i = 1; i <= 5; i++) {
    out += i <= full ? "★" : "☆";
  }
  return out;
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch { return dateStr; }
}