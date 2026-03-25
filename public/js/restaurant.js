// public/js/restaurantPage.js

document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const restaurantId = params.get("id");

  if (!restaurantId) return;

  function formatHours(hoursValue) {
    if (!hoursValue) return "—";

    const parts = hoursValue.split(",");
    if (parts.length !== 2) return hoursValue;

    const [open, close] = parts;

    function to12Hour(time24) {
      if (!time24) return "";
      const [hourStr, minute] = time24.split(":");
      let hour = parseInt(hourStr, 10);
      const suffix = hour >= 12 ? "PM" : "AM";
      hour = hour % 12 || 12;
      return `${hour}:${minute} ${suffix}`;
    }

    return `${to12Hour(open)} – ${to12Hour(close)}`;
  }

  try {
    const res = await fetch(`/api/restaurants/${restaurantId}`);
    const data = await res.json();

    if (!res.ok) {
      console.error(data.message || "Failed to load restaurant.");
      return;
    }

    const restaurant = data.restaurant;
    if (!restaurant) return;

    // Hero title
    const heroTitle = document.querySelector(".hero__title");
    if (heroTitle) {
      heroTitle.textContent = restaurant.restaurantName || "Restaurant";
    }

    //Top Tags:
    const metaItems = document.querySelectorAll(".hero__metaItem");
    if (metaItems[2]) {
    metaItems[2].textContent = restaurant.tags || "No tags yet";
    }

    //Open Now Logic...
    function isOpenNow(hoursString) {
        if (!hoursString) return false;

        const parts = hoursString.split(",");
        if (parts.length !== 2) return false;

        const [open, close] = parts;

        if (!open || !close) return false;

        const now = new Date();

        const [openH, openM] = open.split(":").map(Number);
        const [closeH, closeM] = close.split(":").map(Number);

        const openTime = new Date();
        openTime.setHours(openH, openM, 0, 0);

        const closeTime = new Date();
        closeTime.setHours(closeH, closeM, 0, 0);

        return now >= openTime && now <= closeTime;
    }
            //Determine the hours

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

        const todayHours = hoursMap[todayIndex];
        const open = isOpenNow(todayHours);

        //Update the badge:
    const statusEl = document.querySelector('.status');

        if (statusEl) {
        if (open) {
            statusEl.textContent = "Open now";
            statusEl.classList.remove("status--closed");
            statusEl.classList.add("status--open");
        } else {
            statusEl.textContent = "Closed";
            statusEl.classList.remove("status--open");
            statusEl.classList.add("status--closed");
        }
        }
        
    // Overview subtitle
    const overviewSub = document.querySelector("#overview .card__sub");
    if (overviewSub && restaurant.about) {
      overviewSub.textContent = restaurant.about;
    }

    // Overview highlights
    const highlightValues = document.querySelectorAll(".highlight__value");
    if (highlightValues[0] && restaurant.tags) {
      highlightValues[0].textContent = restaurant.tags;
    }
    if (highlightValues[1] && restaurant.amenities) {
      highlightValues[1].textContent = restaurant.amenities;
    }
    if (highlightValues[2] && restaurant.timeToVisit) {
      highlightValues[2].textContent = restaurant.timeToVisit;
    }

    // About section
    const aboutValues = document.querySelectorAll("#about .aboutItem__value");
    if (aboutValues[0] && restaurant.about) {
      aboutValues[0].textContent = restaurant.about;
    }
    if (aboutValues[1] && restaurant.amenities) {
      aboutValues[1].textContent = restaurant.amenities;
    }
    if (aboutValues[2] && restaurant.timeToVisit) {
      aboutValues[2].textContent = restaurant.timeToVisit;
    }
    if (aboutValues[3] && restaurant.notes) {
      aboutValues[3].textContent = restaurant.notes;
    }

    // Sidebar: address
    const sideRows = document.querySelectorAll(".sideTop__row");
    if (sideRows[0]) {
      const addressValue = sideRows[0].querySelector(".sideValue");
      if (addressValue) {
        addressValue.textContent = restaurant.address || "—";
      }
    }

    // Sidebar: phone
    if (sideRows[1]) {
      const phoneValue = sideRows[1].querySelector(".sideValue");
      if (phoneValue) {
        phoneValue.textContent = restaurant.phone || "—";
      }
    }

    // Sidebar: website
    if (sideRows[2]) {
      const websiteValue = sideRows[2].querySelector(".sideValue");
      if (websiteValue) {
        const websiteLink = websiteValue.querySelector("a");
        if (websiteLink) {
          if (restaurant.website) {
            websiteLink.textContent = restaurant.website;
            websiteLink.href = restaurant.website;
          } else {
            websiteLink.textContent = "—";
            websiteLink.removeAttribute("href");
          }
        }
      }
    }

    // Sidebar: hours
    const hourRows = document.querySelectorAll(".hoursList li");
    const dbHours = [
      restaurant.mondayHours,
      restaurant.tuesdayHours,
      restaurant.wednesdayHours,
      restaurant.thursdayHours,
      restaurant.fridayHours,
      restaurant.saturdayHours,
      restaurant.sundayHours
    ];

    hourRows.forEach((row, index) => {
      const spans = row.querySelectorAll("span");
      if (spans[1]) {
        spans[1].textContent = formatHours(dbHours[index]);
      }
    });

  } catch (error) {
    console.error("Error loading restaurant page:", error);
  }
});

