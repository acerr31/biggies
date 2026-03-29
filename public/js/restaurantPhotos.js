// public/js/restaurantPhotos.js

async function loadLiveRestaurantPhotos() {
  const params = new URLSearchParams(window.location.search);
  const restaurantId = params.get("id");

  if (!restaurantId) return;

  try {
    const [restaurantRes, reviewsRes] = await Promise.all([
      fetch(`/api/restaurants/${restaurantId}`),
      fetch(`/api/reviews/${restaurantId}`)
    ]);

    const restaurantData = await restaurantRes.json();
    const reviewsData = await reviewsRes.json();

    if (!restaurantRes.ok || !reviewsRes.ok) return;

    const restaurantPhotos = Array.isArray(restaurantData.restaurant?.photos)
      ? restaurantData.restaurant.photos
      : [];

    const reviewPhotos = Array.isArray(reviewsData.reviews)
      ? reviewsData.reviews.flatMap(review =>
          Array.isArray(review.photos) ? review.photos : []
        )
      : [];

    const allPhotos = [...new Set([...restaurantPhotos, ...reviewPhotos])];

    renderHeroPhotos(allPhotos);
    renderPhotosSection(allPhotos);

  } catch (error) {
    console.error("Could not load live restaurant photos:", error);
  }
}

function renderHeroPhotos(allPhotos) {
  if (!allPhotos.length) return;

  const mainImg = document.querySelector(".hero__gallery .photo--main img");
  const sideImgs = document.querySelectorAll(".hero__gallery .photoGrid img");

  if (mainImg && allPhotos[0]) {
    mainImg.src = allPhotos[0];
    mainImg.alt = "Restaurant photo";
  }

  sideImgs.forEach((img, index) => {
    const photo = allPhotos[index + 1];
    if (photo) {
      img.src = photo;
      img.alt = `Restaurant photo ${index + 2}`;
    }
  });
}

function renderPhotosSection(allPhotos) {
  const photoWall = document.querySelector(".photoWall");
  const photoSub = document.querySelector("#photos .card__sub");
  const photoFooterMuted = document.querySelector("#photos .card__footer .muted");

  if (!photoWall) return;

  if (!allPhotos.length) {
    photoWall.innerHTML = `<div class="muted">No photos yet.</div>`;
    if (photoSub) photoSub.textContent = "No photos yet.";
    if (photoFooterMuted) photoFooterMuted.textContent = "No live photos available yet.";
    return;
  }

  photoWall.innerHTML = allPhotos
    .map((src, index) => `<img src="${src}" alt="Restaurant photo ${index + 1}">`)
    .join("");

  if (photoSub) {
    photoSub.textContent = `${allPhotos.length} photo${allPhotos.length !== 1 ? "s" : ""}... add more below!`;
  }

  if (photoFooterMuted) {
    photoFooterMuted.textContent = "Check out these pictures from the restaurant";
  }
}

document.addEventListener("DOMContentLoaded", loadLiveRestaurantPhotos);